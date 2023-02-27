import {
	Position,
	Range,
	Hover,
	HoverParams,
	DefinitionParams,
	Location,
	FoldingRangeParams,
	FoldingRange,
	Diagnostic,
	DiagnosticSeverity,
	CompletionParams,
	CompletionItem,
	CompletionItemKind,
	CompletionTriggerKind,
} from 'vscode-languageserver/node';

import {
	SectionedDocument
} from "./SectionedDocument";

import { Workspace } from "./Workspace";
import { RobotController } from './RobotController';
import { RobotControllerFile } from './RobotControllerFile';

import * as Util from './Util';
// import { Position } from 'vscode';
import * as Inform from './Inform';

/**
 * JBI file
 */
export class JbiFile extends RobotControllerFile {
	unknownCommandErrorLevel: DiagnosticSeverity | undefined = undefined;


	constructor( robotController: RobotController, filePath: string ) {
		super( robotController, filePath );

		this.workspace.getDocumentSettings( Util.fsPathToUriString( this.filePath )).then( (settings) => {
			if( settings ) {
				this.unknownCommandErrorLevel = Util.stringToDiagnosticSeverity( settings.unknownCommands.diagnosisLevel );
			}
		} );
	}


	updateSection() {
		if( this.sectionedDocument ) {
			return this.sectionedDocument;
		}
		
		const lines = this.workspace.getTextLines( this.filePath );
		let currentSection = "";
		let headerRange = Range.create(0,0,0,0);
		let contentsRange = Range.create(0,0,0,0);
	
		if( !lines ) {
			return undefined;
		}
	
		this.sectionedDocument = new SectionedDocument();

		for( let i=0; i<lines.length; i++ ) {
			const lineText = lines[i];
			if( lineText.startsWith("//") ) {
				const newSectionName = Util.extractSectionNameFromText( lineText );
				if(newSectionName.length == 0 || lineText.startsWith("///")) {
					headerRange.end.line = i;
					contentsRange.start.line = i + 1;
					contentsRange.end.line = i + 1;
					continue;
				}
				else if( currentSection.length > 0 && contentsRange.start.line != contentsRange.end.line ) {
					// console.log(`new section: ${currentSection} , from ${sectionRange.start.line} to ${sectionRange.end.line}`);
					this.sectionedDocument.setSectionRange( currentSection, {
						header: headerRange,
						contents: contentsRange
					} );
				}
				headerRange = Range.create(i,0,i,0);
				contentsRange = Range.create(i+1,0,i+1,0);
				currentSection = newSectionName;
			}
			else {
				contentsRange.end.line = i+1;
			}
		}
		if( currentSection.length > 0 && contentsRange.start.line != contentsRange.end.line ) {
			this.sectionedDocument.setSectionRange( currentSection, {
				header: headerRange,
				contents: contentsRange
			} );
		}
		
		return this.sectionedDocument;
	}

	private static createJobNamePattern() {
		return /(?<=\s+JOB:)(\S+)/g;
	}

	private static createLabelPattern() {
		return /(?<=\s)(\*\S{1,8})\b/g;
	}
	
	private static createCvarPattern() {
		return /(?<=\s)C([0-9]+)\s/g;
	}

	private static createCommandPattern() {
		return /(^\s*)([A-Z0-9]+)(\s|$)/g;
	}

	private static createIoValuePattern() {
		return /\b(IN|OT)#\(([0-9]+)\)/g;
	}

	private static createVariablePattern() {
		return /(?<=ARGF|\b)(B|I|D|R|S|P|BP|EX)([0-9]+)\b/g;
	}


	private static ioNumberStringToLogicalIoNumber( ioNumberString: string ): number | undefined {
		const m = /(IN|OT)#\(([0-9]+)\)/.exec(ioNumberString);

		if(!m) {
			// not found
			return undefined;
		}

		const ioType = m[1];
		const typeNumberTable = new Map<string, number>([
			["IN", 0],
			["OT", 10000],
		]);
		const typeNumber = typeNumberTable.get( ioType );

		if( typeNumber == undefined ) {
			return undefined;
		}

		const ioNumber = +m[2] - 1;
		const groupNumber = Math.floor(ioNumber / 8) + 1;
		const bitNumber = ioNumber % 8;
		const logicalNumber = typeNumber + groupNumber * 10 + bitNumber;

		return logicalNumber;
	}

	/**
	 * search label
	 * @param label 
	 * @returns Range: label range
	 * @return undefined: label is not found
	 */
	searchLabelRange( label: string ): Range | undefined {
		const sectionedDocument = this.updateSection();
		if( !sectionedDocument ) {
			return undefined;
		}

		const section = sectionedDocument.getSection( "INST" );

		if( !section ) {
			return undefined;
		}

		const escapedLabel = label.replace("*", "\\*");

		const range = this.workspace.searchText( this.filePath, new RegExp(`(?<=^\\s*)${escapedLabel}\\b`), section.contents.start.line, section.contents.end.line );

		if( !range ) {
			return undefined;
		}
		return range;
	}

	
	/**
	 * 
	 * @param cVarNumber 
	 * @returns Range: C-Var range
	 * @return undefined: C-Var is not found
	 */
	searchCvariable( cVarNumber: number ) {
		const sectionedDocument = this.updateSection();
		if( !sectionedDocument ) {
			return undefined;
		}

		const section = sectionedDocument.getSection( "POS" );

		if( !section ) {
			return undefined;
		}

		const range = this.workspace.searchText( this.filePath, new RegExp(`^C0*${cVarNumber}\\b.*`), section.contents.start.line, section.contents.end.line );

		if( !range ) {
			return undefined;
		}
		return range;
	}

	/**
	 * on definition
	 */
	onDefinition(definitionParams: DefinitionParams): Location | null {
		const pos = definitionParams.position;
		const lineRange = Range.create( pos.line, 0, pos.line+1, 0 );
		
		const lineText = this.workspace.getTextLine( this.filePath, pos.line );

		if( !lineText ) {
			return null;
		}

		let m: RegExpExecArray | null;
		const posInLine = pos.character - lineRange.start.character;

		// search JobName
		const jobNamePattern = JbiFile.createJobNamePattern();
		while ((m = jobNamePattern.exec(lineText)) ) {
			if( posInLine < m.index || m.index + m[0].length < posInLine ) {
				continue;
			}
			const jobFileName = m[1];
			
			if( this.robotController.isJbiFileExist( jobFileName ) ) {
				return {
					uri: Util.fsPathToUriString( this.robotController.getJbiFilePath( jobFileName ) ),
					range: Range.create(0,0,0,0)
				};
			}
		}

		// search Label
		const labelPattern = JbiFile.createLabelPattern();
		while ((m = labelPattern.exec(lineText)) ) {
			if( posInLine < m.index || m.index + m[0].length < posInLine ) {
				continue;
			}
			const label = m[1];

			const range = this.searchLabelRange( label );

			if( range ) {
				return {
					uri: Util.fsPathToUriString(this.filePath),
					range: range
				};
			}
			else {
				return null;
			}
		}

		// search C-Var
		const cvarPattern = JbiFile.createCvarPattern();
		while ((m = cvarPattern.exec(lineText)) ) {
			if( posInLine < m.index || m.index + m[0].length < posInLine ) {
				continue;
			}
			const cvarNumber = +m[1];

			const range = this.searchCvariable( cvarNumber );

			if( range ) {
				return {
					uri: Util.fsPathToUriString(this.filePath),
					range: range
				};
			}
			else {
				return null;
			}

		}

		// seach IO value
		{
			const ioPattern = JbiFile.createIoValuePattern();
			let m: RegExpExecArray | null;

			while((m = ioPattern.exec(lineText))){
				if( Util.isPositionInMatch( m, pos ) ) {
					const ioNumberString = m[0];
					const logicalIoNumber = JbiFile.ioNumberStringToLogicalIoNumber(ioNumberString);
					if( logicalIoNumber ) {
						const ioNameLocation = this.robotController.getIoNameLocation( logicalIoNumber );

						if( ioNameLocation ) {
							return ioNameLocation;			
						}
					}
				}
			}

		}

		// seach Variable
		{
			const variablePattern = JbiFile.createVariablePattern();
			let m: RegExpExecArray | null;

			while((m = variablePattern.exec(lineText))){
				if( Util.isPositionInMatch( m, pos ) ) {
					const varType = m[1];
					const varNumber = +m[2];
					const varNameLocation = this.robotController.getVarNameLocation( varType, varNumber );

					if( varNameLocation ) {
						return varNameLocation;			
					}
				}
			}
		}
		

		return null;
	}	


	onHover(hoverParams: HoverParams): Hover | null {
		const sectionedDocument = this.updateSection();
		if( !sectionedDocument ) {
			return null;
		}
		const pos = hoverParams.position;
	
		const sectionName = sectionedDocument.getSectionNameFromLine( pos.line );
		if( !sectionName ) {
			return null;
		}

		const section = sectionedDocument.getSection( sectionName );

		if( !section ) {
			return null;
		}

		const lineText = this.workspace.getTextLine( this.filePath, pos.line );

		if( !lineText ) {
			return null;
		}

		const offset = pos.line - section.contents.start.line;

		if( sectionName == "INST" ) {

			// command
			{
				const m = /^((EDTLCK\s+)?(COMM\s+)?(\t*|\t\s*))([A-Z0-9]+\$?)(\s|$)/.exec(lineText);

				if( m ) {
					// command
					const commandStr = m[5];
					const commandRange = Range.create( Position.create(pos.line, m.index + m[1].length), Position.create(pos.line, m.index + m[1].length + commandStr.length) );
					if( Util.isPositionInRange(commandRange, pos) ) {
						let str = this.tr("jbifile.hover.lineNo" , offset);
						
						if( Inform.isCommandStr( commandStr ) ){
							str += " " + Inform.getDetailCommand( commandStr );
							str += "\n\n" + Inform.getCommandDescription( this.locale, commandStr );
						}

						return {
							contents: {
								kind: "markdown",
								value: str
							}
						};	
					}	
				}
			}
			// variable
			{
				const variablePattern = JbiFile.createVariablePattern();
				let m: RegExpExecArray | null;

				while( (m = variablePattern.exec(lineText)) ){

					if( Util.isPositionInMatch( m, pos ) ) {
						const varType = m[1];
						const varNumber = +m[2];
						const varName = this.robotController.getVarname( varType, varNumber );

						if( varName ) {
							return {
								contents: {
									kind: "markdown",
									value: varName
								}
							};			
						}
					}
				}

			}


			// IO
			{
				const ioPattern = JbiFile.createIoValuePattern();
				let m: RegExpExecArray | null;

				while((m = ioPattern.exec(lineText))){
					if( Util.isPositionInMatch( m, pos ) ) {
						const ioNumberString = m[0];
						const logicalIoNumber = JbiFile.ioNumberStringToLogicalIoNumber(ioNumberString);
						if( logicalIoNumber ) {
							const ioName = this.robotController.getIoName( logicalIoNumber );

							if( ioName ) {
								return {
									contents: {
										kind: "markdown",
										value: ioName
									}
								};			
							}
						}
					}
				}

			}
		}

		return null;
	}

	validateInstTimer( lineNo: number, lineText: string ) {
		const diagnostics: Diagnostic[] = [];

		const pattern = /(?<=\s)T=([-]?[0-9]+(.([0-9]+))?)\b/;
	
		const m = pattern.exec( lineText );

		if( m ) {
			const timerValue = +m[1];
			const decimalStr = m[3];

			const diagnosisRange = Range.create( lineNo, m.index, lineNo, m.index + m[0].length );

			if( timerValue < 0 || timerValue > 655.35 ) {
				diagnostics.push( {
					severity: DiagnosticSeverity.Error,
					range: diagnosisRange,
					message: this.tr('jbifile.diagnostic.tag.T=.invalidValueRange'),
				} );
			}
			else if( timerValue > 65.535 ) {
				diagnostics.push( {
					severity: DiagnosticSeverity.Information,
					range: diagnosisRange,
					message: this.tr('jbifile.diagnostic.tag.T=.warningValueRange'),
				} );
			}
			if( decimalStr?.length >= 3 ) {
				diagnostics.push( {
					severity: DiagnosticSeverity.Information,
					range: diagnosisRange,
					message: this.tr('jbifile.diagnostic.tag.T=.warningDecimalRange'),
				} );
			}

		}	

		return diagnostics;
	}

	validateInstCommands( lineNo: number, lineText: string ) {
		if(!this.unknownCommandErrorLevel) {
			return [];
		}

		const diagnostics: Diagnostic[] = [];

		const pattern = /^((EDTLCK\s+)?(COMM\s+)?(\t*|\t\s*))([A-Z0-9]+\$?)(\s|$)/;
	
		const m = pattern.exec( lineText );

		if( m ) {
			const commandStr = m[5];

			const diagnosisRange = Range.create( lineNo, m[1].length, lineNo, m[1].length + commandStr.length );

			if(!Inform.isCommandStr( commandStr )) {
				diagnostics.push( {
					severity: this.unknownCommandErrorLevel,
					range: diagnosisRange,
					message: this.tr( "jbifile.diagnostic.command.unknown" ),
				} );
			}


		}

		return diagnostics;
	}

	validate(): Diagnostic[] | null {
		const sectionedDocument = this.updateSection();
		if( !sectionedDocument ) {
			return null;
		}
	
		const diagnostics: Diagnostic[] = [];

		const textLines = this.workspace.getTextLines( this.filePath );

		textLines?.forEach( ( lineText, i ) => {

			const sectionName = sectionedDocument.getSectionNameFromLine( i );
			if( !sectionName ) {
				return;
			}

			switch( sectionName ) {
				case "INST": {
					diagnostics.push( ...this.validateInstCommands( i, lineText ) );
					diagnostics.push( ...this.validateInstTimer( i, lineText ) );
		
				} break;
			}
	
		} );
	
	
		return diagnostics;
	}

	onCompletion( completionParams: CompletionParams ): CompletionItem[] | null {
		const pos = completionParams.position;
		const lineText = this.workspace.getTextLine( this.filePath, pos.line );

		if( !lineText ) {
			return null;
		}

		const posInLine = pos.character;

		const isJobTagPos = (text: string, posInLine: number) => {
			const jobTagPattern = /(?<=\sJOB):\S*/g;
			let m: RegExpExecArray | null;
			while ((m = jobTagPattern.exec(text)) ) {
				if( m.index <= posInLine && posInLine <= m.index + m[0].length ) {
					return true;
				}
			}
			return false;
		}; 


		// JOB: tag
		// show job names
		// e.g. CALL JOB:<JOBNAME>
		if( isJobTagPos( lineText, posInLine ) ) {
			const jobNames = this.robotController.getJobNameList();

			return jobNames.map( jobName => {
				return {
					label: jobName,	
					kind: CompletionItemKind.Function,
				};
			} );	
		}

		return null;
	}
}