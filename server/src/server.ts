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

import * as Util from './Util';
import { Workspace } from './Workspace';
import { RobotController } from './RobotController';

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
const workspace = new Workspace( documents );

const robotControllerMap = new Map<string, RobotController>();

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

interface Section {
	range: Range
}

interface VarDatSection {
	sectionMap: Map<string, Section>	// <variableType, section>
}

interface IoNameDatSection {
	sectionMap: Map<string, Section>	// <ioType, section>
}

interface IomNameDatSection {
	sectionMap: Map<string, Section>	// <iomType, section>
}

const ioNameDatSectionMap = new Map<string, IoNameDatSection>(); // <filePath, IomNameDatSection>
const iomNameDatSectionMap = new Map<string, IomNameDatSection>(); // <filePath, IomNameDatSection>

function getRobotControllerFromFsPath( fsPath: string ) {
	const folderPath = path.dirname( fsPath );

	let robotController = robotControllerMap.get( folderPath );

	if( robotController ) {
		return robotController;
	}

	robotController = new RobotController( workspace, folderPath );

	robotControllerMap.set( folderPath, robotController );
	
	return robotController;
}

function getIoNameDatSectionMap( filePath: string ) {
	let ioNameDatSection = ioNameDatSectionMap.get(filePath);

	if( ioNameDatSection ) {
		return ioNameDatSection;
	}

	ioNameDatSection = {
		sectionMap: new Map<string, Section>()
	};

	const lines = workspace.getTextLines( filePath );
	let currentSection = "";
	let sectionRange = Range.create(0,0,0,0);

	if( !lines ) {
		return undefined;
	}

	for( let i=0; i<lines.length; i++ ) {
		const lineText = lines[i];
		if( lineText.startsWith("/") ) {
			const newSectionName = Util.extractSectionNameFromText( lineText );
			if(newSectionName.length == 0) {
				continue;
			}
			else if( currentSection.length > 0 && sectionRange.start.line != sectionRange.end.line ) {
				console.log(`new section: ${currentSection} , from ${sectionRange.start.line} to ${sectionRange.end.line}`);
				ioNameDatSection.sectionMap.set( currentSection, {
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
		ioNameDatSection.sectionMap.set( currentSection, {
			range: sectionRange
		} );
	}

	ioNameDatSectionMap.set(filePath, ioNameDatSection);

	return ioNameDatSection;
}

function getIomNameDatSectionMap( filePath: string ) {
	let iomNameDatSection = iomNameDatSectionMap.get(filePath);

	if( iomNameDatSection ) {
		return iomNameDatSection;
	}

	iomNameDatSection = {
		sectionMap: new Map<string, Section>()
	};

	const lines = workspace.getTextLines( filePath );
	let currentSection = "";
	let sectionRange = Range.create(0,0,0,0);

	if( !lines ) {
		return undefined;
	}

	for( let i=0; i<lines.length; i++ ) {
		const lineText = lines[i];
		if( lineText.startsWith("/") ) {
			const newSectionName = Util.extractSectionNameFromText( lineText );
			if(newSectionName.length == 0) {
				continue;
			}
			else if( newSectionName == "NAME") {
				sectionRange.start.line = i+1;
				sectionRange.end.line = i+1;
				continue;
			}
			else if( currentSection.length > 0 && sectionRange.start.line != sectionRange.end.line ) {
				console.log(`new section: ${currentSection} , from ${sectionRange.start.line} to ${sectionRange.end.line}`);
				iomNameDatSection.sectionMap.set( currentSection, {
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
		iomNameDatSection.sectionMap.set( currentSection, {
			range: sectionRange
		} );
	}

	iomNameDatSectionMap.set(filePath, iomNameDatSection);

	return iomNameDatSection;
}

function getIoNameDatSectionNameFromLineNo( filePath: string, lineNo: integer ) {
	const ioNameDatSection = getIoNameDatSectionMap( filePath );

	if(!ioNameDatSection) {
		return "";
	}

	for( const [sectionName, section] of ioNameDatSection.sectionMap ){
		if( lineNo >= section.range.start.line && lineNo < section.range.end.line ) {
			return sectionName;
		}
	}
	
	return "";
}

function getIomNameDatSectionNameFromLineNo( filePath: string, lineNo: integer ) {
	const iomNameDatSection = getIomNameDatSectionMap( filePath );

	if(!iomNameDatSection) {
		return "";
	}

	for( const [sectionName, section] of iomNameDatSection.sectionMap ){
		if( lineNo >= section.range.start.line && lineNo < section.range.end.line ) {
			return sectionName;
		}
	}
	
	return "";
}


function validateFile(textDocument: TextDocument) {
	const filePath = URI.parse( textDocument.uri ).fsPath;
	const fileName = path.basename( filePath );
	const robotController = getRobotControllerFromFsPath( filePath );

	const extname = path.extname(fileName).toUpperCase();
	if( extname === ".PSC" ) {
		const file = robotController.getPscFile( fileName );
		if( file ) {
			const diagnostics = file.validate();
			if( diagnostics ) {
				connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
			}
		}
	}

	return;
}



function onHoverIoNameDat(hoverParams: HoverParams): Hover | null {
	const document = documents.get(hoverParams.textDocument.uri);
	const pos = hoverParams.position;

	if(document != null) {
		const filePath = URI.parse(hoverParams.textDocument.uri).fsPath;
		const sectionName = getIoNameDatSectionNameFromLineNo( filePath, pos.line );

		const section = getIoNameDatSectionMap( filePath )?.sectionMap.get( sectionName );

		if( section ) {
			const offset = pos.line - section.range.start.line;

			const lineRange = Range.create( pos.line, 0, pos.line+1, 0 );
			const lineText = document.getText( lineRange );
			const index = Util.getIndexAtPosition( lineText, pos.character );
			return {
				contents: [
					`${sectionName} ${offset*4 + index + 1}`
				]
			};
		}
		else {
			return null;
		}
	}

	return null;
}

function onHoverIomNameDat(hoverParams: HoverParams): Hover | null {
	const document = documents.get(hoverParams.textDocument.uri);
	const pos = hoverParams.position;

	if(document != null) {
		const filePath = URI.parse(hoverParams.textDocument.uri).fsPath;
		const sectionName = getIomNameDatSectionNameFromLineNo( filePath, pos.line );

		const section = getIomNameDatSectionMap( filePath )?.sectionMap.get( sectionName );

		if( section ) {
			const offset = pos.line - section.range.start.line;
			const str = document.getText( Range.create( pos.line, 0, pos.line, pos.character) );

			return {
				contents: [
					`M ${offset}`
				]
			};
		}
		else {
			return null;
		}
	}

	return null;
}


connection.onHover( 
	(hoverParams: HoverParams): Hover | null  => {
		const filePath = Util.uriStringToFsPath( hoverParams.textDocument.uri );
		const fileName = path.basename( filePath );
		const robotController = getRobotControllerFromFsPath( filePath );

		const extname = path.extname(fileName).toUpperCase();
		if( extname === ".PRM" ) {
			const parameterFile = robotController.getParameterFile(filePath);
			if( parameterFile ) {
				return parameterFile.onHover( hoverParams );
			}
			return null;
		}
		else if( fileName == "VAR.DAT") {
			const varDatFile = robotController.getVarDatFile(filePath);
			if( varDatFile ) {
				return varDatFile.onHover( hoverParams );
			}
			return null;
		}
		else if( fileName == "IONAME.DAT" || fileName == "EXIONAME.DAT" ) {
			return onHoverIoNameDat(hoverParams);
		}
		else if( fileName == "IOMNAME.DAT") {
			return onHoverIomNameDat(hoverParams);
		}
		else if( extname == ".PSC") {
			const pscFile = robotController.getPscFile( filePath );
			if( pscFile ) {
				return pscFile.onHover( hoverParams );
			}
			return null;
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

			const robotController = getRobotControllerFromFsPath( filePath );

			return robotController.getParameterLocation( paramType, paramNumber );
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
