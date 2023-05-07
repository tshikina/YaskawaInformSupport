import {
	Range,
	Hover,
	HoverParams,
	FoldingRangeParams,
	FoldingRange,
	Diagnostic,
	DiagnosticSeverity,
	CodeAction,
	CodeActionParams,
	TextDocumentEdit,
	TextEdit,
	OptionalVersionedTextDocumentIdentifier,
	WorkspaceEdit,
	CodeActionKind,
} from 'vscode-languageserver/node';

import {
	Section,
	SectionedDocument
} from "./SectionedDocument";

import {
	Workspace,
} from "./Workspace";

import { RobotControllerFile } from './RobotControllerFile';

import * as Util from './Util';
import { Position } from 'vscode';

export class VarNameDatFile extends RobotControllerFile {

	varNameTable: Map<string, Map<number, string>> | undefined;


	updateVarName() {
		if( this.varNameTable ) {
			return;
		}

		this.varNameTable = new Map<string, Map<number, string>>();

		const sectionedDocument = this.updateSection();
		if( !sectionedDocument ) {
			return null;
		}

		const textLines = this.workspace.getTextLines( this.filePath );

		if( !textLines ) {
			return;
		}

		const varTypes = ["B", "I", "D", "R", "S", "P", "BP", "EX"];

		varTypes.forEach( (varType) => {
			const section = sectionedDocument.getSection( "///" + varType );

			if( !section ) {
				return;
			}

			const table = new Map<number, string>();

			for( let lineNo = section.contents.start.line; lineNo < section.contents.end.line; lineNo++ ) {
				const text = textLines[lineNo];

				const m = /^([0-9]+)\s+[0-9]+,[0-9+]+,(.*)/.exec( text );

				if( m ) {
					const varNumber = +m[1];
					const varName = m[2];
					table.set( varNumber, varName );
				}
				else {
					break;
				}
			}

			this.varNameTable?.set( varType, table );
		} );
	}

	getVarName( varType: string, varNumber: number ): string | undefined {
		this.updateVarName();

		return this.varNameTable?.get(varType)?.get( varNumber );
	}


	getVarNameRange( varType: string, varNumber: number ): Range | null {
		const sectionedDocument = this.updateSection();
		if( !sectionedDocument ) {
			return null;
		}

		const section = sectionedDocument.getSection( "///" + varType );

		if( !section ) {
			return null;
		}

		const textLines = this.workspace.getTextLines( this.filePath );

		if( !textLines ) {
			return null;
		}

		for( let lineNo = section.contents.start.line; lineNo < section.contents.end.line; lineNo++ ) {
			const lineText = textLines[lineNo];

			const m = /^([0-9]+)\s+[0-9]+,[0-9+]+,(.*)/.exec( lineText );

			if( m ) {
				const lineVarNumber = +m[1];

				if( varNumber == lineVarNumber ) {
					return Range.create( lineNo, 0, lineNo, lineText.length );
				}

			}
			else {
				break;
			}

		}

		return null;
	}

	/**
	 * @brief count number of same var names
	 * @returns var name count table
	 */
	getVarNameCnt(): Map<string, number> | undefined {
		this.updateVarName();
		
		if( !this.varNameTable ) {
			return undefined;
		}

		// count number of same io names
		const varNameCnt = new Map<string, number>();

		this.varNameTable.forEach( (table) => {
			table.forEach( (varNname) => {
				let cnt = varNameCnt.get( varNname );
				if( !cnt ) {
					cnt = 0;
				}
	
				cnt++;
	
				varNameCnt.set( varNname, cnt );
	
			} );
		} );

		return varNameCnt;		
	}


	validate(): Diagnostic[] | null {

		const isVarNameAliasEnabled = this.robotController.getOptions().isVarNameAliasEnabled();
		const isIoNameAliasEnabled = this.robotController.getOptions().isIoNameAliasEnabled();
		if( isVarNameAliasEnabled != undefined && isVarNameAliasEnabled == false ) {
			return null;
		}

		this.updateVarName();

		if( !this.varNameTable ) {
			return null;
		}

		const varNameCntTable = this.getVarNameCnt();

		if( !varNameCntTable ) {
			return null;
		}

		const ioNameDatFile = this.robotController.getIoNameDatFile( this.robotController.getFilePath("IONAME.DAT") );
		let ioNameCntTable : Map<string, number> | undefined;
		if( isIoNameAliasEnabled )
		{
			ioNameCntTable = ioNameDatFile?.getIoNameCnt();
		}

		const diagnostics: Diagnostic[] = [];

		// check same io names
		this.varNameTable.forEach( (table, varType) => {
			table.forEach( (varName, varNumber) => {
				const varNameCnt = varNameCntTable.get( varName );
				let ioNameCnt = ioNameCntTable?.get( varName );
				ioNameCnt = ioNameCnt ? ioNameCnt : 0;

				if( !varNameCnt || (varNameCnt + ioNameCnt) < 2 || varName.startsWith("'") ) {
					return;
				}

				const range = this.getVarNameRange( varType, varNumber );

				if( !range ) {
					return;
				}

				let errorMessage : string;
				if( varNameCnt >= 2)
				{
					errorMessage = this.tr( "varnamedatfile.diagnostic.name.duplicated", varName );
				}
				else
				{
					errorMessage = this.tr( "ionamedatfile.diagnostic.name.duplicated", varName );
				}

				const replaceText = this.workspace.
					getTextLine( this.filePath, range.start.line )?.
					replace( /^([0-9]+\s+[0-9]+,[0-9+]+,)(.*)/, `$1'${varName}`);
	
				diagnostics.push({
					severity: DiagnosticSeverity.Information,
					range: range,
					message: errorMessage,
					data: replaceText // quick fix
				});
				
			} );
		} );
	
		return diagnostics;
	}

	onCodeAction(codeActionParams: CodeActionParams): CodeAction[] | null {
		if( !codeActionParams.context.only ) {
			return null;
		}
		if( codeActionParams.context.only.length == 0) {
			return null;
		}

		if( codeActionParams.context.only[0] != CodeActionKind.QuickFix ) {
			return null;
		}

		const codeActions: CodeAction[] = [];

		codeActionParams.context.diagnostics.forEach((diag) => {
			if( diag.data == undefined ) {
				return;
			}
		
			if( typeof diag.data !== "string" ) {
				return;
			}
			
			const replaceText = diag.data as string;
			if( !replaceText ) {
				return;
			}

			const title = this.tr("varnamedatfile.quickfix.name.toComment");

			const edits = [TextEdit.replace(diag.range, replaceText)];

			const workspaceEdit:WorkspaceEdit = {
				documentChanges: [
					TextDocumentEdit.create(
						OptionalVersionedTextDocumentIdentifier.create(Util.fsPathToUriString( this.filePath), null ),
						edits
					)
				]
			};
			// make code action
			const fixAction = CodeAction.create(
				title,
				workspaceEdit,
				CodeActionKind.QuickFix
			);
			fixAction.diagnostics = [diag];
			codeActions.push(fixAction);
		});
		
		return codeActions;
	}

}