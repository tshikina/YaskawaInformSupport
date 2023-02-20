import {
	Range,
	Hover,
	HoverParams,
	FoldingRangeParams,
	FoldingRange,
} from 'vscode-languageserver/node';

import {
	Section,
	SectionedDocument
} from "./SectionedDocument";

import {
	Workspace,
} from "./Workspace";

import { RobotControllerFile } from './RobotControllerFile';

import * as Util from './Util';

export class VarNameDatFile extends RobotControllerFile {

	varNameTable: Map<string, Map<number, string>> | undefined;


	updateVarName() {
		if( this.varNameTable ) {
			return;
		}

		this.varNameTable = new Map<string, Map<number, string>>();

		const sectionedDocument = this.updateSection();
		if( !sectionedDocument ) {
			return null;
		}

		const textLines = this.workspace.getTextLines( this.filePath );

		if( !textLines ) {
			return;
		}

		const varTypes = ["B", "I", "D", "R", "S", "P", "BP", "EX"];

		varTypes.forEach( (varType) => {
			const section = sectionedDocument.getSection( "///" + varType );

			if( !section ) {
				return;
			}

			const table = new Map<number, string>();

			for( let lineNo = section.contents.start.line; lineNo < section.contents.end.line; lineNo++ ) {
				const text = textLines[lineNo];

				const m = /^([0-9]+)\s+[0-9]+,[0-9+]+,(.*)/.exec( text );

				if( m ) {
					const varNumber = +m[1];
					const varName = m[2];
					table.set( varNumber, varName );
				}
				else {
					break;
				}
			}

			this.varNameTable?.set( varType, table );
		} );
	}

	getVarName( varType: string, varNumber: number ): string | undefined {
		this.updateVarName();

		return this.varNameTable?.get(varType)?.get( varNumber );
	}

}