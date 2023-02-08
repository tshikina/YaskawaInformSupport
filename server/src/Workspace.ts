import {
	TextDocuments,
	Range,
	ConfigurationItem,
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import { URI } from 'vscode-uri';
import * as fs from "fs";
import * as path from 'path';
import { start } from 'repl';

// Extension settings
interface InformExtensionSettings {
	maxNumberOfProblems: number;
	locale: string;
	unknownCommands: {
		diagnosisLevel: string;
	};
}


export class Workspace {

	hasConfigurationCapability = false;
	hasWorkspaceFolderCapability = false;
	hasDiagnosticRelatedInformationCapability = false;

	defaultSettings: InformExtensionSettings = {
		maxNumberOfProblems: 1000,
		locale: "en",
		unknownCommands: {
			diagnosisLevel: "none"
		}
	};
	// The global settings, used when the `workspace/configuration` request is not supported by the client.
	// Please note that this is not the case when using this server with the client provided in this example
	// but could happen with other clients.
	globalSettings: InformExtensionSettings = this.defaultSettings;

	documents: TextDocuments<TextDocument>;
	getConfigurationFunc: (item: ConfigurationItem) => Promise<any>;

	// Cache the settings of all open documents
	private documentSettings: Map<string, Thenable<InformExtensionSettings>> = new Map();

	constructor( documents: TextDocuments<TextDocument>, getConfigurationFunc: (item: ConfigurationItem) => Promise<any> ) {
		this.documents = documents;
		this.getConfigurationFunc = getConfigurationFunc;
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

	/**
	 *  search text
	 * @returns Range: searched text range
	 * @return undefined: text is not found
	 * @return null: file is not found
	 */
	searchText( filePath: string, regexp: RegExp, startLine?: number, endLine?: number ):Range | null | undefined {
		const fileUri = URI.file(filePath).toString();
	
		const document = this.documents.get(fileUri);
		let range: Range | null | undefined;
	
		if( document ) {
			startLine = startLine != undefined ? startLine : 0;
			endLine = endLine != undefined ? endLine : document.lineCount;

			const range = Range.create( 0, 0, 0, 0);

			for( let i = startLine; i < endLine; i++ ) {
				range.start.line = i;
				range.end.line = i+1;

				const text = document.getText( range );

				const m = text.match( regexp );

				if( m ) {
					const index = ( m.index != undefined ? m.index : 0 );
					return Range.create( i, index, i, index + m[0].length );
				}
			}
		}
		else if( fs.existsSync( filePath ) ) {
			const lines = this.getTextLines( filePath );

			if( !lines ) {
				return undefined;
			}

			startLine = startLine != undefined ? startLine : 0;
			endLine = endLine != undefined ? endLine : lines.length;

			for( let i = startLine; i < endLine; i++ ) {
				const text = lines[i];

				const m = text.match( regexp );

				if( m ) {
					const index = ( m.index != undefined ? m.index : 0 );
					return Range.create( i, index, i, index + m[0].length );
				}
			}

		}
		else {
			return null;
		}
		return undefined;
	}


	clearDocumentSettingsCache() {
		this.documentSettings.clear();
	}

	deleteDocumentSettingsCache( uri: string ) {
		this.documentSettings.delete(uri);
	}

	getDocumentSettings(resource: string): Thenable<InformExtensionSettings> {
		if (!this.hasConfigurationCapability) {
			return Promise.resolve(this.globalSettings);
		}
		let result = this.documentSettings.get(resource);
		if (!result) {
			result = this.getConfigurationFunc({
				scopeUri: resource,
				section: 'yaskawaInformLanguageClient'
			});
			this.documentSettings.set(resource, result);
		}
		return result;
	}
	
}
