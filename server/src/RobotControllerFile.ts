import {
	Range,
	Hover,
	HoverParams,
	Diagnostic,
	DefinitionParams,
	Location,
	FoldingRangeParams,
	FoldingRange,
	CompletionParams,
	CompletionItem,
	CodeAction,
	CodeActionParams,
} from 'vscode-languageserver/node';

import {
	SectionedDocument
} from "./SectionedDocument";

import { Workspace } from "./Workspace";
import { RobotController } from './RobotController';
import { 
	translate,
	isLocaleSupported,
} from './Translation';

import * as path from "path";

import * as Util from './Util';

export class RobotControllerFile {
	workspace: Workspace;
	robotController: RobotController;
	filePath: string;
	locale = "en";

	sectionedDocument: SectionedDocument | undefined;

	constructor( robotController: RobotController, filePath: string ) {
		this.workspace = robotController.getWorkspace();
		this.robotController = robotController;
		this.filePath = filePath;
		this.workspace.getDocumentSettings( Util.fsPathToUriString( this.filePath )).then( (settings) => {
			if( settings ) {
				if( !isLocaleSupported( settings.locale ) ) {
					this.locale = this.workspace.defaultSettings.locale;
				}
				else {
					this.locale = settings.locale.toString();
				}
			}
		} );
	}

	/** translation with files locale */
	tr( key: string, ...values: any[]) {
		return translate( this.locale, key, ...values );
	}

	/**
	 * return file name
	 * @returns fileName
	 */
	fileName() {
		return path.basename( this.filePath );
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
				const newSectionName = lineText;
				if(newSectionName.length == 0) {
					headerRange.end.line = i;
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

	validate(): Diagnostic[] | null {
		return null;
	}

	/**
	 * on definition
	 */
	onDefinition(definitionParams: DefinitionParams): Location | null {
		return null;
	}	

	onHover(hoverParams: HoverParams): Hover | null {
		return null;
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

	onCompletion( completionParams: CompletionParams ): CompletionItem[] | null {
		return null;
	}

	onCodeAction( codeActionParams: CodeActionParams ): CodeAction[] | null {
		return null;
	}
}