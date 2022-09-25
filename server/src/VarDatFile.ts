import {
	Range,
	Hover,
	HoverParams,
} from 'vscode-languageserver/node';

import {
	Section,
	SectionedDocument
} from "./SectionedDocument";

import {
	Workspace,
} from "./Workspace";

import * as Util from './Util';

export class VarDatFile {
	workspace: Workspace;
	sectionedDocument: SectionedDocument | undefined;
	filePath: string;

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
		let sectionRange = Range.create(0,0,0,0);
	
		if( !lines ) {
			return undefined;
		}
	
		this.sectionedDocument = new SectionedDocument();

		for( let i=0; i<lines.length; i++ ) {
			const lineText = lines[i];
			if( lineText.startsWith("/") ) {
				const newSectionName = Util.extractSectionNameFromText( lineText );
				if(newSectionName.length == 0) {
					continue;
				}
				else if( currentSection.length > 0 && sectionRange.start.line != sectionRange.end.line ) {
					// console.log(`new section: ${currentSection} , from ${sectionRange.start.line} to ${sectionRange.end.line}`);
					this.sectionedDocument.setSectionRange( currentSection, {
						header: sectionRange,
						contents: sectionRange
					} );
				}
				sectionRange = Range.create(i+1,0,i+1,0);
				currentSection = newSectionName;
			}
			else {
				sectionRange.end.line = i+1;
			}
		}
		if( currentSection.length > 0 && sectionRange.start.line != sectionRange.end.line ) {
			this.sectionedDocument.setSectionRange( currentSection, {
				header: sectionRange,
				contents: sectionRange
			} );
		}
		
		return this.sectionedDocument;
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
		
		if( sectionName == "B" || sectionName == "I" || sectionName == "D" || sectionName == "R") {
			const index = Util.getIndexAtPosition( lineText, pos.character );
			return {
				contents: [
					`${sectionName} ${offset*10 + index}`
				]
			};
		}
		return {
			contents: [
				`${sectionName} ${offset}`
			]
		};
	}
}