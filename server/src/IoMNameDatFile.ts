import {
	Range,
	Hover,
	HoverParams,
	FoldingRangeParams,
	FoldingRange,
} from 'vscode-languageserver/node';

import {
	SectionedDocument
} from "./SectionedDocument";

import {
	Workspace,
} from "./Workspace";

import * as Util from './Util';

export class IoMNameDatFile {
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
					continue;
				}
				else if( newSectionName == "NAME") {
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
		
		return {
			contents: [
				`M ${offset}`
			]
		};
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