import {
	Range,
	Hover,
	HoverParams,
	FoldingRangeParams,
	FoldingRange,
	Diagnostic,
	DiagnosticSeverity,
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


	validate(): Diagnostic[] | null {

		const isVarNameAliasEnabled = this.robotController.getOptions().isVarNameAliasEnabled();
		if( isVarNameAliasEnabled != undefined && isVarNameAliasEnabled == false ) {
			return null;
		}

		this.updateVarName();

		if( !this.varNameTable ) {
			return null;
		}

		const varNameCnt = new Map<string, number>();

		// count number of same io names
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

		const diagnostics: Diagnostic[] = [];

		// check same io names
		this.varNameTable.forEach( (table, varType) => {
			table.forEach( (varName, varNumber) => {
				const cnt = varNameCnt.get( varName );
				if( !cnt || cnt < 2 || varName.startsWith("'") ) {
					return;
				}			
				const range = this.getVarNameRange( varType, varNumber );

				if( !range ) {
					return;
				}
	
				diagnostics.push({
					severity: DiagnosticSeverity.Information,
					range: range,
					message: this.tr( "varnamedatfile.diagnostic.name.duplicated", varName ),
				});
				
			} );
		} );
	
		return diagnostics;
	}

}