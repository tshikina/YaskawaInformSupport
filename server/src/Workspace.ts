import {
	TextDocuments,
	Range,
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import { URI } from 'vscode-uri';
import * as fs from "fs";
import * as path from 'path';


export class Workspace {
	documents: TextDocuments<TextDocument>;

	constructor( documents: TextDocuments<TextDocument> ) {
		this.documents = documents;
	}

	getTextLines( filePath: string ) {
		let lines : Array<string> | undefined;
		const fileUri = URI.file(filePath).toString();
	
		const document = this.documents.get(fileUri);
	
		if( document ) {
			lines = new Array<string>(0);
	
			const range = Range.create( 0, 0, 0, 0);
			for( let i=0; i < document.lineCount; i++ ) {
				range.start.line = i;
				range.end.line = i+1;
				const lineText = document.getText( range ).replace(/[\r\n]/g,"");
				lines.push(lineText);
			}
		}
		else {
			try{
				fs.readFileSync(filePath);
				const text = fs.readFileSync(filePath, "utf-8");
				lines = text.replace("\r\n","\n").split("\n");
			}
			catch(err) {
				console.error( `cannot read file: ${filePath}` );
			}
		}
	
		return lines;
	}
	
	getTextLine( filePath: string, lineNo: number) {
		let lineText: string | undefined;
		const fileUri = URI.file(filePath).toString();
	
		const document = this.documents.get(fileUri);
	
		if( document ) {
			const range = Range.create( lineNo, 0, lineNo + 1, 0);
			lineText = document.getText( range ).replace(/[\r\n]/g,"");
		}
		else {
			const lines = this.getTextLines( filePath );
	
			if( lines && lines.length > lineNo ) {
				lineText = lines[lineNo];
			}
		}
		return lineText;
	}
}
