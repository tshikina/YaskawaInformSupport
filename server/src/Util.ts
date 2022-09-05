import {
	Range,
} from 'vscode-languageserver/node';


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
