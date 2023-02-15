import {
	Range,
	Hover,
	HoverParams,
	FoldingRangeParams,
	FoldingRange,
	integer,
} from 'vscode-languageserver/node';

import {
	SectionedDocument
} from "./SectionedDocument";

import {
	Workspace,
} from "./Workspace";

import { RobotControllerFile } from './RobotControllerFile';

import * as Util from './Util';

export class IoNameDatFile extends RobotControllerFile {

	ioNameTable: Map<number, string> | undefined;

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
				if(newSectionName.length == 0) {
					headerRange.end.line = i;
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

	
	updateIoName() {
		if( this.ioNameTable ) {
			return;
		}
		this.ioNameTable = new Map<number, string>();

		const sectionedDocument = this.updateSection();
		if( !sectionedDocument ) {
			return null;
		}

		const textLines = this.workspace.getTextLines( this.filePath );

		if( !textLines ) {
			return;
		}

		const typeNumberTable = new Map<string, number>([
			["IN", 0],
			["OUT", 10000],
			["EXIN", 20000],
			["EXOUT", 30000],
		]);

		const sectionNames = sectionedDocument.getSectionNames();
		sectionNames.forEach( ( sectionName ) => {
			const section = sectionedDocument.getSection( sectionName );

			if( !section ) {
				return;
			}

			const typeNumber = typeNumberTable.get(sectionName);

			if(typeNumber == undefined) {
				// error: unknown io type
				return;
			}


			for( let lineNo = section.contents.start.line; lineNo < section.contents.end.line; lineNo++ ) {
				const text = textLines[lineNo];

				const names = text.split(",");

				const offset = lineNo - section.contents.start.line;

				names.forEach( (name, i ) => {
					if( name.length > 0 ) {
						const index = offset * 4 + i;
						const groupNumber = Math.floor( index / 8 ) + 1;
						const bitNumber = index % 8;
						const logicNumber = typeNumber + groupNumber * 10 + bitNumber; 
						this.ioNameTable?.set( logicNumber, name );	
					}
				} );

			}
			
		});
	}

	getIoName( logicalNumber: number ): string | undefined {
		this.updateIoName();

		return this.ioNameTable?.get( logicalNumber );
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

		const lineText = this.workspace.getTextLine( filePath, pos.line );

		if( !lineText ) {
			return null;
		}

		const offset = pos.line - section.contents.start.line;
		const index = Util.getIndexAtPosition( lineText, pos.character );
		
		return {
			contents: [
				`${sectionName} ${offset*4 + index + 1}`
			]
		};
	}
}