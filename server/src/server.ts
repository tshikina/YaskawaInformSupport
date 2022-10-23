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
	FoldingRangeParams,
	FoldingRange,
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
import * as Translation from './Translation';


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

	if( params.locale ) {
		console.log( `locale: ${params.locale}`);
		Translation.initTranslation(params.locale);
	}
	else {
		Translation.initTranslation("en");
	}

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
			definitionProvider: true,
			foldingRangeProvider: true
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
	const filePath = Util.uriStringToFsPath( change.document.uri );
	const robotController = getRobotControllerFromFsPath( filePath );

	robotController.clearFileCache(filePath);

	requestValidation( filePath );
});


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


function validateFile(textDocument: TextDocument) {
	const filePath = URI.parse( textDocument.uri ).fsPath;
	const robotController = getRobotControllerFromFsPath( filePath );

	const file = robotController.getFile(filePath);

	if( file ) {
		const diagnostics = file.validate();
		if( diagnostics ) {
			connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
		}
	}

	return;
}


const validationTimer = setTimeout( validateRequestedFiles, 5000 );
const updateDocumentSet: Set<TextDocument> = new Set<TextDocument>();
function validateRequestedFiles() {
	// console.log("update validation");
	updateDocumentSet.forEach( document => {
		validateFile( document );
	} );
	updateDocumentSet.clear();
}

function requestValidation( filePath: string ) {
	const folderPath = path.dirname( filePath );

	documents.all().forEach( document => {
		const documentPath = Util.uriStringToFsPath(document.uri);
		const documentFolder = path.dirname( documentPath );
		
		if( documentFolder == folderPath ) {
			updateDocumentSet.add( document );
		}
	});

	validationTimer.refresh();
}

connection.onHover( 
	(hoverParams: HoverParams): Hover | null  => {
		const filePath = Util.uriStringToFsPath( hoverParams.textDocument.uri );
		const robotController = getRobotControllerFromFsPath( filePath );

		const file = robotController.getFile(filePath);

		if( file ) {
			return file.onHover( hoverParams );
		}

		return null;
	}
);


connection.onDefinition(
	( definitionParams ) : Definition | null => {
		const filePath = URI.parse( definitionParams.textDocument.uri ).fsPath.toString();
		const robotController = getRobotControllerFromFsPath( filePath );

		const file = robotController.getFile(filePath);

		if( file ) {
			return file.onDefinition( definitionParams );
		}

		return null;

	}
);


connection.onFoldingRanges( foldingRangeParam => {
	const filePath = URI.parse( foldingRangeParam.textDocument.uri ).fsPath.toString();
	const robotController = getRobotControllerFromFsPath( filePath );

	const file = robotController.getFile(filePath);

	if( file ) {
		return file.onFoldingRanges( foldingRangeParam );
	}

	return null;
} );

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
