import {
	Range
} from 'vscode-languageserver/node';

export interface Section {
	header: Range,
	contents: Range,
}


export class SectionedDocument {
	sectionMap: Map<string, Section>;	// <sectionName, section>

	constructor() {
		this.sectionMap = new Map<string, Section>();
	}

	getSection( sectionName: string ) {
		return this.sectionMap.get( sectionName );
	}

	setSectionRange( sectionName: string, section: Section ) {
		this.sectionMap.set( sectionName, section );
	}

	getSectionNameFromLine( lineNo: number ){
		for( const [sectionName, section] of this.sectionMap ){
			if( lineNo >= section.contents.start.line && lineNo < section.contents.end.line ) {
				return sectionName;
			}
		}
		return undefined;	
	}
}

