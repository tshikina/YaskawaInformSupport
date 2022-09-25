import {
	Range,
	Hover,
	HoverParams,
	FoldingRangeParams,
	FoldingRange,
} from 'vscode-languageserver/node';

import {
	Section,
	SectionedDocument
} from "./SectionedDocument";

import {
	Workspace,
} from "./Workspace";

import * as Util from './Util';

export class ParameterFile {
	workspace: Workspace;
	sectionedDocument: SectionedDocument | undefined;
	filePath: string;

	parameterValueMap: Map<string, number> | null = null; // <parameterNumber, value>


	constructor( workspace: Workspace, filePath: string ) {
		this.workspace = workspace;
		this.filePath = filePath;
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
			if( lineText.startsWith("/") ) {
				const newSectionName = Util.extractSectionNameFromText( lineText );
				if(newSectionName.length == 0 || newSectionName == "CRC") {
					headerRange.end.line = i;
					contentsRange.start.line = i+1;
					contentsRange.end.line = i+1;
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


	isParameterExist(parameterType: string, parameterNumber: number): boolean {
		const sectionedDocument = this.updateSection();
		if( !sectionedDocument ) {
			return false;
		}

		const section = sectionedDocument.getSection( parameterType );

		if( !section ) {
			return false;
		}

		const valueRange = (section.contents.end.line - section.contents.start.line) * 10;

		if( parameterNumber < 0 || parameterNumber >= valueRange ) {
			return false;
		}

		return true;
	}

	getParameterRange(parameterType: string, parameterNumber: number) : Range | null {
		const sectionedDocument = this.updateSection();
		if( !sectionedDocument ) {
			return null;
		}

		const section = sectionedDocument.getSection( parameterType );

		if( !section ) {
			return null;
		} 

		const lineNo = section.contents.start.line + Math.floor(parameterNumber/10);
		const lineText = this.workspace.getTextLine( this.filePath, lineNo );
		if( lineText ) {
			const parameterRange = Util.getRangeAtIndex( lineText, parameterNumber % 10 );
			if( parameterRange ) {
				parameterRange.start.line = lineNo;
				parameterRange.end.line = lineNo;

				return parameterRange;
			}
		}
		
		return null;
	}

	updateParameterValue() {
		if( this.parameterValueMap ) {
			return this.parameterValueMap;
		}

		const textLines = this.workspace.getTextLines( this.filePath );

		if( !textLines  || textLines.length <= 0 ) {
			return null;
		}

		const parameterValueMap = new Map<string, number>();

		let sectionName = "";
		let startLine = 0;
		for( let i = 0; i < textLines.length; i++) {
			const lineText = textLines[i];
			const newSectionName = Util.extractSectionNameFromText( lineText );
			if( lineText.startsWith("/") ) {
				startLine = i+1;
				if(newSectionName.length == 0 || newSectionName == "CRC") {
					continue;
				}
				sectionName = newSectionName;
			}
			else {
				const valueStrings = lineText.split(",");
				valueStrings.forEach( (valueStr, index) => {
					const newParamNumberStr = sectionName + (((i - startLine)) * 10 + index);
					parameterValueMap.set( newParamNumberStr, +valueStr );
				});
			}
		}

		this.parameterValueMap = parameterValueMap;
		
		return parameterValueMap;
	}

	/**
	 * Get parameter value
	 * 
	 * @param parameterType 
	 * @param parameterNumber 
	 * @returns number: parameter value
	 * @return undefined: out of range
	 * @return null: file is not found
	 */
	getParameterValue( parameterType: string, parameterNumber: number ): number | null | undefined {
		const parameterValueMap = this.updateParameterValue();

		if( !parameterValueMap ) {
			return null;
		}

		if( !this.isParameterExist( parameterType, parameterNumber ) ) {
			return undefined;
		}
		
		const value = parameterValueMap.get( parameterType + parameterNumber );

		return value ? value : 0;
	}


	onHover(hoverParams: HoverParams): Hover | null {
		const sectionedDocument = this.updateSection();
		if( !sectionedDocument ) {
			return null;
		}
		const pos = hoverParams.position;
	
		const filePath = Util.uriStringToFsPath( hoverParams.textDocument.uri );
		const sectionName = sectionedDocument.getSectionNameFromLine( pos.line );
		if( !sectionName ) {
			return null;
		}

		const section = sectionedDocument.getSection( sectionName );

		if( !section ) {
			return null;
		}

		const offset = pos.line - section.contents.start.line;
		const lineText = this.workspace.getTextLine( filePath, pos.line );

		if( lineText ) {
			const index = Util.getIndexAtPosition( lineText, pos.character );
			return {
				contents: [
					`${sectionName} ${offset*10 + index}`
				]
			};	
		}
	
		return null;
	}

	onFoldingRanges( foldingRangeParam: FoldingRangeParams ) {
		const foldingRanges: FoldingRange[] = [];

		const sectionedDocument = this.updateSection();
		if( !sectionedDocument ) {
			return null;
		}

		sectionedDocument.sectionMap.forEach((value, key) => {
			const foldingRange = FoldingRange.create( value.header.start.line, value.contents.end.line-1 );
			foldingRanges.push(foldingRange);
		});

		return foldingRanges;
	}
}