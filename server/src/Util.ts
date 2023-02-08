import {
	Position,
	Range,
	DiagnosticSeverity,
} from 'vscode-languageserver/node';

import { URI } from 'vscode-uri';


/**
 * extract section name from line text
 * 
 * e.g.
 * //SectionName
 * -> SectionName
 * 
 * @param lineText lineText
 * @returns 
 */
export function extractSectionNameFromText( lineText: string ) {
	const m = /^[/]*(\S*)/.exec(lineText);

	if( m ) {
		return m[1];
	}

	return "";
}


/**
 * get range at index in the line
 * 
 * @param lineText lineText
 * @param index index in line
 * @returns 
 */
 export function getRangeAtIndex( lineText: string, index: number ): Range | undefined {
	const pattern = new RegExp(`^(([^,]*,){${index}})([^,]*)`);

	const m = pattern.exec( lineText );

	if( m ) {
		return Range.create(0, m[1].length, 0, m[1].length + m[3].length);
	}

	return undefined;
}


/**
 * get index at position in the line
 * 
 * @param lineText line text
 * @param position position in line
 * @returns 
 */
 export function getIndexAtPosition( lineText: string, position: number ): number {
	const str = lineText.substring(0,position);

	let index = str.match(/,/g)?.length;
	index = index ? index : 0;

	return index;
}


export function uriStringToFsPath( uri: string ): string {
	return URI.parse(uri).fsPath;
}

export function fsPathToUriString( fsPath: string ): string {
	return URI.file( fsPath ).toString();
}

export function stringToDiagnosticSeverity( levelStr: string ): DiagnosticSeverity | undefined  {
	let retValue: DiagnosticSeverity | undefined;
	
	switch( levelStr ) {
		case "none": retValue = undefined; break;
		case "hint": retValue = DiagnosticSeverity.Hint; break;
		case "information": retValue = DiagnosticSeverity.Information; break;
		case "warning": retValue = DiagnosticSeverity.Warning; break;
		case "error": retValue = DiagnosticSeverity.Error; break;
		default: retValue = undefined; break;
	}

	return retValue;
}

export function isPositionInRange( range:Range, position:Position ): boolean {
	if( position.line < range.start.line ) {
		return false;
	}

	if( position.line > range.end.line ) {
		return false;
	}

	if( position.line == range.start.line && position.character < range.start.character ) {
		return false;
	}

	if( position.line == range.end.line && position.character >= range.end.character ) {
		return false;
	}

	return true;
}