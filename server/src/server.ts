/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */
import {
	createConnection,
	TextDocuments,
	Diagnostic,
	DiagnosticSeverity,
	ProposedFeatures,
	InitializeParams,
	DidChangeConfigurationNotification,
	CompletionItem,
	CompletionItemKind,
	TextDocumentPositionParams,
	TextDocumentSyncKind,
	InitializeResult,
	HoverParams,
	Hover,
	MarkupContent,
	Range,
	WorkspaceFolder,
	Definition,
	DefinitionParams,
	Location,
} from 'vscode-languageserver/node';

import {
	TextDocument
} from 'vscode-languageserver-textdocument';

import { URI } from 'vscode-uri';
import * as fs from "fs";
import path = require('path');
import { MochaInstanceOptions } from 'mocha';
import { integer } from 'vscode-languageclient';

function createJobNamePattern() {
	return /(?<=\s+JOB:)(\S+)/g;
}

function createLabelPattern() {
	return /(?<=\s)(\*\S{1,8})\b/g;
}

function createCvarPattern() {
	return /(?<=\s)C([0-9]+)\s/g;
}

// Create a connection for the server, using Node's IPC as a transport.
// Also include all preview / proposed LSP features.
const connection = createConnection(ProposedFeatures.all);

// Create a simple text document manager.
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

let hasConfigurationCapability = false;
let hasWorkspaceFolderCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

let workspaceFolders : WorkspaceFolder[] | null;

connection.onInitialize((params: InitializeParams) => {
	const capabilities = params.capabilities;

	workspaceFolders = params.workspaceFolders;
	

	// Does the client support the `workspace/configuration` request?
	// If not, we fall back using global settings.
	hasConfigurationCapability = !!(
		capabilities.workspace && !!capabilities.workspace.configuration
	);
	hasWorkspaceFolderCapability = !!(
		capabilities.workspace && !!capabilities.workspace.workspaceFolders
	);
	hasDiagnosticRelatedInformationCapability = !!(
		capabilities.textDocument &&
		capabilities.textDocument.publishDiagnostics &&
		capabilities.textDocument.publishDiagnostics.relatedInformation
	);

	const result: InitializeResult = {
		capabilities: {
			textDocumentSync: TextDocumentSyncKind.Incremental,
			// Tell the client that this server supports code completion.
			// completionProvider: {
			// 	resolveProvider: true
			// },
			hoverProvider: true,
			definitionProvider: true
		}
	};
	if (hasWorkspaceFolderCapability) {
		result.capabilities.workspace = {
			workspaceFolders: {
				supported: true
			}
		};
	}
	return result;
});

connection.onInitialized(() => {
	if (hasConfigurationCapability) {
		// Register for all configuration changes.
		connection.client.register(DidChangeConfigurationNotification.type, undefined);
	}
	if (hasWorkspaceFolderCapability) {
		connection.workspace.onDidChangeWorkspaceFolders(_event => {
			connection.console.log('Workspace folder change event received.');
		});
	}
});

// The example settings
interface ExampleSettings {
	maxNumberOfProblems: number;
}


// The global settings, used when the `workspace/configuration` request is not supported by the client.
// Please note that this is not the case when using this server with the client provided in this example
// but could happen with other clients.
const defaultSettings: ExampleSettings = { maxNumberOfProblems: 1000 };
let globalSettings: ExampleSettings = defaultSettings;

// Cache the settings of all open documents
const documentSettings: Map<string, Thenable<ExampleSettings>> = new Map();

connection.onDidChangeConfiguration(change => {
	if (hasConfigurationCapability) {
		// Reset all cached document settings
		documentSettings.clear();
	} else {
		globalSettings = <ExampleSettings>(
			(change.settings.yaskawaInformLanguageClient || defaultSettings)
		);
	}

	// Revalidate all open text documents
	documents.all().forEach(validateFile);
});

function getDocumentSettings(resource: string): Thenable<ExampleSettings> {
	if (!hasConfigurationCapability) {
		return Promise.resolve(globalSettings);
	}
	let result = documentSettings.get(resource);
	if (!result) {
		result = connection.workspace.getConfiguration({
			scopeUri: resource,
			section: 'yaskawaInformLanguageClient'
		});
		documentSettings.set(resource, result);
	}
	return result;
}

// Only keep settings for open documents
documents.onDidClose(e => {
	documentSettings.delete(e.document.uri);
});

// The content of a text document has changed. This event is emitted
// when the text document first opened or when its content has changed.
documents.onDidChangeContent(change => {
	validateFile( change.document );
});

// async function validateTextDocument(textDocument: TextDocument): Promise<void> {
// 	// In this simple example we get the settings for every validate run.
// 	const settings = await getDocumentSettings(textDocument.uri);

// 	// The validator creates diagnostics for all uppercase words length 2 and more
// 	const text = textDocument.getText();
// 	const pattern = /\b[A-Z]{2,}\b/g;
// 	let m: RegExpExecArray | null;

// 	let problems = 0;
// 	const diagnostics: Diagnostic[] = [];
// 	while ((m = pattern.exec(text)) && problems < settings.maxNumberOfProblems) {
// 		problems++;
// 		const diagnostic: Diagnostic = {
// 			severity: DiagnosticSeverity.Information,
// 			range: {
// 				start: textDocument.positionAt(m.index),
// 				end: textDocument.positionAt(m.index + m[0].length)
// 			},
// 			message: `${m[0]} is all uppercase.`,
// 			source: 'ex'
// 		};
// 		if (hasDiagnosticRelatedInformationCapability) {
// 			diagnostic.relatedInformation = [
// 				{
// 					location: {
// 						uri: textDocument.uri,
// 						range: Object.assign({}, diagnostic.range)
// 					},
// 					message: 'Spelling matters'
// 				},
// 				{
// 					location: {
// 						uri: textDocument.uri,
// 						range: Object.assign({}, diagnostic.range)
// 					},
// 					message: 'Particularly for names'
// 				}
// 			];
// 		}
// 		diagnostics.push(diagnostic);
// 	}

// 	// Send the computed diagnostics to VSCode.
// 	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
// }


// connection.onDidChangeWatchedFiles(_change => {
// 	// Monitored files have change in VSCode
// 	connection.console.log('We received an file change event');
// });

// This handler provides the initial list of the completion items.
// connection.onCompletion(
// 	(_textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
// 		// The pass parameter contains the position of the text document in
// 		// which code complete got requested. For the example we ignore this
// 		// info and always provide the same completion items.
// 		return [
// 			{
// 				label: 'TypeScript',
// 				kind: CompletionItemKind.Text,
// 				data: 1
// 			},
// 			{
// 				label: 'JavaScript',
// 				kind: CompletionItemKind.Text,
// 				data: 2
// 			}
// 		];
// 	}
// );

// This handler resolves additional information for the item selected in
// the completion list.
// connection.onCompletionResolve(
// 	(item: CompletionItem): CompletionItem => {
// 		if (item.data === 1) {
// 			item.detail = 'TypeScript details';
// 			item.documentation = 'TypeScript documentation';
// 		} else if (item.data === 2) {
// 			item.detail = 'JavaScript details';
// 			item.documentation = 'JavaScript documentation';
// 		}
// 		return item;
// 	}
// );

interface Section {
	range: Range
}

interface ParamSection {
	sectionMap: Map<string, Section>	// <parameter, section>
}

interface VarDatSection {
	sectionMap: Map<string, Section>	// <variableType, section>
}

const paramSectionMap = new Map<string, ParamSection>(); // <filePath, paramSection>
const varDatSectionMap = new Map<string, VarDatSection>(); // <filePath, VarDatSection>
const paramFileValueMap = new Map<string, Map<string, number>>(); // <filePath, <parameterNumber, value>>

function getTextLines( filePath: string ) {
	let lines : Array<string> | undefined;
	const fileUri = URI.file(filePath).toString();

	const document = documents.get(fileUri);

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

function getTextLine( filePath: string, lineNo: number) {
	let lineText: string | undefined;
	const fileUri = URI.file(filePath).toString();

	const document = documents.get(fileUri);

	if( document ) {
		const range = Range.create( lineNo, 0, lineNo + 1, 0);
		lineText = document.getText( range ).replace(/[\r\n]/g,"");
	}
	else {
		const lines = getTextLines( filePath );

		if( lines && lines.length > lineNo ) {
			lineText = lines[lineNo];
		}
	}
	return lineText;
}

function getRangeAtIndex( lineText: string, index: number ): Range | undefined {
	const pattern = new RegExp(`^(([^,]*,){${index}})([^,]*)`);

	const m = pattern.exec( lineText );

	if( m ) {
		return Range.create(0, m[1].length, 0, m[1].length + m[3].length);
	}

	return undefined;
}

function extractSectionNameFromText( lineText: string ) {
	const m = /^[/]*(\S*)/.exec(lineText);

	if( m ) {
		return m[1];
	}

	return "";
}

function getParameterSectionMap( filePath: string ) {
	let paramSection = paramSectionMap.get(filePath);

	if( paramSection ) {
		return paramSection;
	}

	paramSection = {
		sectionMap: new Map<string, Section>()
	};

	const lines = getTextLines( filePath );
	let currentSection = "";
	let sectionRange = Range.create(0,0,0,0);

	if( !lines ) {
		return undefined;
	}

	for( let i=0; i<lines.length; i++ ) {
		const lineText = lines[i];
		if( lineText.startsWith("/") ) {
			const newSectionName = extractSectionNameFromText( lineText );
			if(newSectionName.length == 0 || newSectionName == "CRC") {
				sectionRange.start.line = i+1;
				sectionRange.end.line = i+1;
				continue;
			}
			else if( currentSection.length > 0 && sectionRange.start.line != sectionRange.end.line ) {
				// console.log(`new section: ${currentSection} , from ${sectionRange.start.line} to ${sectionRange.end.line}`);
				paramSection.sectionMap.set( currentSection, {
					range: sectionRange
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
		paramSection.sectionMap.set( currentSection, {
			range: sectionRange
		} );
	}

	paramSectionMap.set(filePath, paramSection);

	return paramSection;
}

function getVarDatSectionMap( filePath: string ) {
	let varDatSection = varDatSectionMap.get(filePath);

	if( varDatSection ) {
		return varDatSection;
	}

	varDatSection = {
		sectionMap: new Map<string, Section>()
	};

	const lines = getTextLines( filePath );
	let currentSection = "";
	let sectionRange = Range.create(0,0,0,0);

	if( !lines ) {
		return undefined;
	}

	for( let i=0; i<lines.length; i++ ) {
		const lineText = lines[i];
		if( lineText.startsWith("/") ) {
			const newSectionName = extractSectionNameFromText( lineText );
			if(newSectionName.length == 0) {
				continue;
			}
			else if( currentSection.length > 0 && sectionRange.start.line != sectionRange.end.line ) {
				console.log(`new section: ${currentSection} , from ${sectionRange.start.line} to ${sectionRange.end.line}`);
				varDatSection.sectionMap.set( currentSection, {
					range: sectionRange
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
		varDatSection.sectionMap.set( currentSection, {
			range: sectionRange
		} );
	}

	varDatSectionMap.set(filePath, varDatSection);

	return varDatSection;
}

function getParameterValue( filePath: string, parameterType: string, parameterNumber: number ) {
	const paramPath = path.join( path.dirname(filePath), "ALL.PRM" );

	let value: undefined | number = undefined;
	let paramValueMap = paramFileValueMap.get( paramPath );

	const paramNumberStr = parameterType + parameterNumber;

	if( !paramValueMap ) {
		// update value
		const textLines = getTextLines( paramPath );

		if( textLines && textLines.length > 0 ) {
			paramValueMap = new Map<string, number>();
			paramFileValueMap.set( paramPath, paramValueMap );
			let sectionName = "";
			let startLine = 0;
			for( let i = 0; i < textLines.length; i++) {
				const lineText = textLines[i];
				const newSectionName = extractSectionNameFromText( lineText );
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
						paramValueMap?.set( newParamNumberStr, +valueStr );
					});
				}
			}
		}
	}

	value = paramValueMap?.get( paramNumberStr );

	return value;
}

function getParameterSectionNameFromLineNo( filePath: string, lineNo: integer ) {
	const paramSection = getParameterSectionMap( filePath );

	if(!paramSection) {
		return "";
	}

	for( const [sectionName, section] of paramSection.sectionMap ){
		if( lineNo >= section.range.start.line && lineNo < section.range.end.line ) {
			return sectionName;
		}
	}
	
	return "";
}


function getVarDatSectionNameFromLineNo( filePath: string, lineNo: integer ) {
	const varDatSection = getVarDatSectionMap( filePath );

	if(!varDatSection) {
		return "";
	}

	for( const [sectionName, section] of varDatSection.sectionMap ){
		if( lineNo >= section.range.start.line && lineNo < section.range.end.line ) {
			return sectionName;
		}
	}
	
	return "";
}


function validatePsc(textDocument: TextDocument) {

	const filePath = URI.parse( textDocument.uri ).fsPath;
	const folderPath = path.dirname(filePath);
	const allParamPath = path.join(folderPath, "ALL.PRM");

	if( !fs.existsSync(allParamPath) ) {
		return;
	}

	const diagnostics: Diagnostic[] = [];
	const lineRange = Range.create(0,0,0,0);

	for( let i = 0; i < textDocument.lineCount; i++ ) {
		lineRange.start.line = i;
		lineRange.end.line = i+1;

		const lineText = textDocument.getText(lineRange);

		const pattern = /^(\S+)\s*,\s*([0-9]+)\s*,\s*([-]?[0-9]+)/;

		const m = pattern.exec( lineText );

		if( m ) {
			const paramType = m[1];
			const paramNumber = +m[2];
			const paramValue = +m[3];

			const expectedValue = getParameterValue( filePath, paramType, paramNumber );

			const diagnosisRange = Range.create( i, m.index, i, m[0].length );

			if( expectedValue == undefined ) {
				diagnostics.push( {
					severity: DiagnosticSeverity.Warning,
					range: diagnosisRange,
					message: `${paramType + paramNumber} is NOT found in ALL.PRM.`,
					source: 'ex'
				} );
			}
			else if( paramValue != expectedValue ) {
				diagnostics.push( {
					severity: DiagnosticSeverity.Warning,
					range: diagnosisRange,
					message: `${paramType + paramNumber} value '${paramValue}' is NOT match with ALL.PRM value '${expectedValue}.'`,
					source: 'ex'
				} );
			}
			else {
				diagnostics.push( {
					severity: DiagnosticSeverity.Information,
					range: diagnosisRange,
					message: `Matched with ALL.PRM`,
					source: 'ex'
				} );
			}
		}
	}
	// Send the computed diagnostics to VSCode.
	connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

function validateFile(textDocument: TextDocument) {
	const filePath = URI.parse( textDocument.uri ).fsPath;
	const fileName = path.basename( filePath );

	const extname = path.extname(fileName).toUpperCase();
	if( extname === ".PSC" ) {
		return validatePsc( textDocument );
	}

}

function onHoverParam(hoverParams: HoverParams): Hover | null {
	const document = documents.get(hoverParams.textDocument.uri);
	const pos = hoverParams.position;
	const lineRange = Range.create( pos.line, 0, pos.line+1, 0 );

	let lineText: string;

	if(document != null) {
		const filePath = URI.parse(hoverParams.textDocument.uri).fsPath;
		const sectionName = getParameterSectionNameFromLineNo( filePath, pos.line );

		const section = getParameterSectionMap( filePath )?.sectionMap.get( sectionName );

		if( section ) {
			const offset = pos.line - section.range.start.line;
			const str = document.getText( Range.create( pos.line, 0, pos.line, pos.character) );
			let index = str.match(/,/g)?.length;
			index = index ? index : 0;
			return {
				contents: [
					`${sectionName} ${offset*10 + index}`
				]
			};
		}
		else {
			return null;
		}
	}

	return null;
}


function onHoverVarDat(hoverParams: HoverParams): Hover | null {
	const document = documents.get(hoverParams.textDocument.uri);
	const pos = hoverParams.position;
	const lineRange = Range.create( pos.line, 0, pos.line+1, 0 );

	let lineText: string;

	if(document != null) {
		const filePath = URI.parse(hoverParams.textDocument.uri).fsPath;
		const sectionName = getVarDatSectionNameFromLineNo( filePath, pos.line );

		const section = getVarDatSectionMap( filePath )?.sectionMap.get( sectionName );

		if( section ) {
			const offset = pos.line - section.range.start.line;
			const str = document.getText( Range.create( pos.line, 0, pos.line, pos.character) );

			if( sectionName == "B" || sectionName == "I" || sectionName == "D" || sectionName == "R") {
				let index = str.match(/,/g)?.length;
				index = index ? index : 0;
				return {
					contents: [
						`${sectionName} ${offset*10 + index}`
					]
				};
			}
			else {
				return {
					contents: [
						`${sectionName} ${offset}`
					]
				};
			}
		}
		else {
			return null;
		}
	}

	return null;
}

function onHoverPsc(hoverParams: HoverParams): Hover | null {
	const document = documents.get(hoverParams.textDocument.uri);
	const pos = hoverParams.position;
	const lineRange = Range.create( pos.line, 0, pos.line+1, 0 );

	let lineText: string;

	if(document != null) {
		const str = document.getText( lineRange );

		const m = /^\s*([^,\s]+)\s*,\s*([0-9]+)\s*,/.exec(str);

		if( m ) {
			const paramType = m[1];
			const paramNumber = +m[2];
			const paramValue = getParameterValue( URI.parse(hoverParams.textDocument.uri).fsPath, paramType, paramNumber );

			if( paramValue ) {
				return {
					contents: [`${paramType + paramNumber}: ${paramValue}`]
				};
			}
		}
		else {
			// console.log("parameter not match: " + str);

		}

	}

	return null;
}

connection.onHover( 
	(hoverParams: HoverParams): Hover | null  => {
		const filePath = URI.parse( hoverParams.textDocument.uri ).fsPath.replace( /\\/g, "/" );
		const fileName = path.basename( filePath );

		const extname = path.extname(fileName).toUpperCase();
		if( extname === ".PRM" ) {
			return onHoverParam( hoverParams );
		}
		else if( fileName == "VAR.DAT") {
			return onHoverVarDat(hoverParams);
		}
		else if( extname == ".PSC") {
			return onHoverPsc(hoverParams);
		}

		return null;
	}
);

function onDefinitionJbi(definitionParams: DefinitionParams) {
	const document = documents.get(definitionParams.textDocument.uri);
	const pos = definitionParams.position;
	const lineRange = Range.create( pos.line, 0, pos.line+1, 0 );

	const filePath = URI.parse( definitionParams.textDocument.uri ).fsPath.replace( /\\/g, "/" );
	const dirPath = path.dirname(filePath);


	let lineText: string;
	
	if(document != null)
	{
		lineText = document.getText( lineRange );
		let m: RegExpExecArray | null;
		const posInLine = pos.character - lineRange.start.character;

		// search JobName
		const jobNamePattern = createJobNamePattern();
		while ((m = jobNamePattern.exec(lineText)) ) {
			if( posInLine < m.index || m.index + m[0].length < posInLine ) {
				continue;
			}
			const jobFileName = m[1] + ".JBI";
			
			const jobFilePath = path.join( dirPath, jobFileName );

			if( fs.existsSync( jobFilePath ) ) {
				return {
					uri: URI.file(jobFilePath).toString(),
					range: Range.create(0,0,0,0)
				};
			}
		}

		// search Label
		const labelPattern = createLabelPattern();
		while ((m = labelPattern.exec(lineText)) ) {
			if( posInLine < m.index || m.index + m[0].length < posInLine ) {
				continue;
			}
			const label = m[1];
			const escapedLabel = label.replace("*", "\\*");

			let isInstructionSection = false;
			for( let i = 0; i< document.lineCount; i++ ) {
				let str = document.getText(Range.create(i, 0, i+1, 0));
				str = str.replace(/[\r\n]/g,"");

				if( !isInstructionSection) {
					if(str === "//INST") {
						isInstructionSection = true;
					}
				}
				else {
					const mm = str.match( `(?<=^\\s*)${escapedLabel}\\b` );
					if( mm?.index != undefined ) {
						return {
							uri: definitionParams.textDocument.uri,
							range: Range.create(i, mm.index, i, str.length)
	
						};
					}
				}
			}
		}

		// search C-Var
		const cvarPattern = createCvarPattern();
		while ((m = cvarPattern.exec(lineText)) ) {
			if( posInLine < m.index || m.index + m[0].length < posInLine ) {
				continue;
			}
			const cvarNumber = m[1];

			let isPositionSection = false;
			for( let i = 0; i< document.lineCount; i++ ) {
				let str = document.getText(Range.create(i, 0, i+1, 0));
				str = str.replace(/[\r\n]/g,"");

				if( !isPositionSection ) {
					if(str === "//POS") {
						isPositionSection = true;
					}
				}
				else {
					const mm = str.match( /^C([0-9]+)=.*$/ );
					if( mm?.index != undefined && mm[1] == cvarNumber ) {
						return {
							uri: definitionParams.textDocument.uri,
							range: Range.create(i, mm.index, i, str.length)
	
						};
					}
				}
			}
		}
	}
	return null;
}

function onDefinitionPsc(definitionParams: DefinitionParams) {
	const document = documents.get(definitionParams.textDocument.uri);
	const pos = definitionParams.position;
	const lineRange = Range.create( pos.line, 0, pos.line+1, 0 );

	let lineText: string;

	if(document != null) {
		const str = document.getText( lineRange );
		const filePath = URI.parse(definitionParams.textDocument.uri).fsPath;

		const m = /^\s*([^,\s]+)\s*,\s*([0-9]+)\s*,/.exec(str);

		if( m ) {
			const paramType = m[1];
			const paramNumber = +m[2];

			const paramPath = path.join(path.dirname( filePath ), "ALL.PRM" );

			const section = getParameterSectionMap( paramPath )?.sectionMap.get( paramType );

			if( section ) {
				const lineNo = section.range.start.line + Math.floor(paramNumber/10);
				const lineText = getTextLine( paramPath, lineNo );
				if( lineText ) {
					const paramRange = getRangeAtIndex( lineText, paramNumber % 10 );
					if( paramRange ) {
						paramRange.start.line = lineNo;
						paramRange.end.line = lineNo;

						return {
							uri: URI.file(paramPath).toString(),
							range: paramRange
						};
	
					}
				}
			}

		}
	}

	return null;
}

connection.onDefinition(
	(definitionParams ) : Definition | null => {
		const filePath = URI.parse( definitionParams.textDocument.uri ).fsPath.toString();
		const fileName = path.basename( filePath );

		const extname = path.extname(fileName).toUpperCase();
		if( extname === ".JBI" ) {
			return onDefinitionJbi( definitionParams );
		}
		else if( extname === ".PSC" ) {
			return onDefinitionPsc( definitionParams );
		}

		return null;

	}
);


// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
