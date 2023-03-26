import {
	Range,
	Hover,
	HoverParams,
	FoldingRangeParams,
	FoldingRange,
	integer,
	Diagnostic,
	DiagnosticSeverity,
} from 'vscode-languageserver/node';

import {
	SectionedDocument
} from "./SectionedDocument";

import {
	Workspace,
} from "./Workspace";

import { RobotControllerFile } from './RobotControllerFile';

import * as Util from './Util';

export class IoNameDatFile extends RobotControllerFile {

	private ioNameTable: Map<number, string> | undefined;

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

	
	updateIoName() {
		if( this.ioNameTable ) {
			return;
		}
		this.ioNameTable = new Map<number, string>();

		const sectionedDocument = this.updateSection();
		if( !sectionedDocument ) {
			return null;
		}

		const textLines = this.workspace.getTextLines( this.filePath );

		if( !textLines ) {
			return;
		}

		const typeNumberTable = new Map<string, number>([
			["IN", 0],
			["OUT", 10000],
			["EXIN", 20000],
			["EXOUT", 30000],
		]);

		const sectionNames = sectionedDocument.getSectionNames();
		sectionNames.forEach( ( sectionName ) => {
			const section = sectionedDocument.getSection( sectionName );

			if( !section ) {
				return;
			}

			const typeNumber = typeNumberTable.get(sectionName);

			if(typeNumber == undefined) {
				// error: unknown io type
				return;
			}


			for( let lineNo = section.contents.start.line; lineNo < section.contents.end.line; lineNo++ ) {
				const text = textLines[lineNo];

				const names = text.split(",");

				const offset = lineNo - section.contents.start.line;

				names.forEach( (name, i ) => {
					if( name.length > 0 ) {
						const index = offset * 4 + i;
						const groupNumber = Math.floor( index / 8 ) + 1;
						const bitNumber = index % 8;
						const logicNumber = typeNumber + groupNumber * 10 + bitNumber; 
						this.ioNameTable?.set( logicNumber, name );	
					}
				} );

			}
			
		});
	}

	getIoName( logicalNumber: number ): string | undefined {
		this.updateIoName();

		return this.ioNameTable?.get( logicalNumber );
	}

	getIoNameRange( logicalIoNumber: number ): Range | null {
		const sectionedDocument = this.updateSection();
		if( !sectionedDocument ) {
			return null;
		}

		const sectionNameTable = new Map<number, string>([
			[0, "IN"],
			[10000, "OUT"],
			[20000, "EXIN"],
			[30000, "EXOUT"],
		]);
		const typeNumber = Math.floor( logicalIoNumber / 10000 ) * 10000;

		const sectionName = sectionNameTable.get( typeNumber );

		if( !sectionName ) {
			return null;
		}

		const section = sectionedDocument.getSection( sectionName );

		if( !section ) {
			return null;
		}

		const groupNumber = Math.floor((logicalIoNumber - typeNumber)/10);
		const bitNumber = logicalIoNumber % 10;

		const lineNo = section.contents.start.line + (groupNumber - 1) * 2 + Math.floor( bitNumber / 4 );
		const lineText = this.workspace.getTextLine( this.filePath, lineNo );
		if( lineText ) {
			const ioNameRange = Util.getRangeAtIndex( lineText, bitNumber % 4 );
			if( ioNameRange ) {
				ioNameRange.start.line = lineNo;
				ioNameRange.end.line = lineNo;

				return ioNameRange;
			}
		}

		return null;
	}

	/**
	 * @brief count number of same io names
	 * @returns io name count table
	 */
	getIoNameCnt(): Map<string, number> | undefined {
		this.updateIoName();
		
		if( !this.ioNameTable ) {
			return undefined;
		}

		// count number of same io names
		const ioNameCnt = new Map<string, number>();

		this.ioNameTable.forEach( (name) => {
			let cnt = ioNameCnt.get( name );
			if( !cnt ) {
				cnt = 0;
			}

			cnt++;

			ioNameCnt.set( name, cnt );
		} );

		return ioNameCnt;		
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
		const index = Util.getIndexAtPosition( lineText, pos.character );
		
		return {
			contents: [
				`${sectionName} ${offset*4 + index + 1}`
			]
		};
	}

	validate(): Diagnostic[] | null {

		const isIoNameAliasEnabled = this.robotController.getOptions().isIoNameAliasEnabled();
		const isVarNameAliasEnabled = this.robotController.getOptions().isVarNameAliasEnabled();
		if( isIoNameAliasEnabled != undefined && isIoNameAliasEnabled == false ) {
			return null;
		}

		this.updateIoName();

		if( !this.ioNameTable ) {
			return null;
		}

		const ioNameCntTable = this.getIoNameCnt();

		if( !ioNameCntTable ) {
			return null;
		}

		const varNameDatFile = this.robotController.getVarNameDatFile( this.robotController.getFilePath("VARNAME.DAT") );
		let varNameCntTable : Map<string, number> | undefined;
		if( isVarNameAliasEnabled )
		{
			varNameCntTable = varNameDatFile?.getVarNameCnt();
		}

		const diagnostics: Diagnostic[] = [];

		// check same io names
		this.ioNameTable.forEach( (ioName, logicalIoNumber) => {
			const ioNameCnt = ioNameCntTable.get( ioName );
			let varNameCnt = varNameCntTable?.get( ioName );
			varNameCnt = varNameCnt ? varNameCnt : 0;
			if( !ioNameCnt || (ioNameCnt + varNameCnt)< 2 || ioName.startsWith("'") ) {
				return;
			}			

			const range = this.getIoNameRange( logicalIoNumber );

			if( !range ) {
				return;
			}

			let errorMessage : string;
			if( ioNameCnt >= 2)
			{
				errorMessage = this.tr( "ionamedatfile.diagnostic.name.duplicated", ioName );
			}
			else
			{
				errorMessage = this.tr( "varnamedatfile.diagnostic.name.duplicated", ioName );
			}

			diagnostics.push({
				severity: DiagnosticSeverity.Information,
				range: range,
				message: errorMessage,
			});
		} );	
	
		return diagnostics;
	}

}