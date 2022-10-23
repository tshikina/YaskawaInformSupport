import {
	Range,
	Hover,
	HoverParams,
	Diagnostic,
	DiagnosticSeverity,
	DefinitionParams,
	Location,
	FoldingRange,
	FoldingRangeParams,
} from 'vscode-languageserver/node';

import {
	Workspace,
} from "./Workspace";

import { RobotController } from './RobotController';
import { RobotControllerFile } from './RobotControllerFile';
import { translate as tr } from './Translation';

export class PscFile extends RobotControllerFile {

	onHover(hoverParams: HoverParams): Hover | null {
		const pos = hoverParams.position;
	
		const str = this.workspace.getTextLine(this.filePath, pos.line);

		if( !str ) {
			return null;
		}

		const m = /^\s*([^,\s]+)\s*,\s*([0-9]+)\s*,/.exec(str);

		if( m ) {
			const paramType = m[1];
			const paramNumber = +m[2];
			const paramValue = this.robotController.getParameterValue( paramType, paramNumber );

			if( paramValue != undefined && paramValue != null ) {
				return {
					contents: [`${paramType + paramNumber}: ${paramValue}`]
				};
			}
		}
		else {
			// console.log("parameter not match: " + str);

		}

	
		return null;
	}

	/**
	 * on definition
	 */
	onDefinition(definitionParams: DefinitionParams): Location | null {
		const pos = definitionParams.position;
		const lineRange = Range.create( pos.line, 0, pos.line+1, 0 );
		
		const lineText = this.workspace.getTextLine( this.filePath, pos.line );

		if( !lineText ) {
			return null;
		}

		const m = /^\s*([^,\s]+)\s*,\s*([0-9]+)\s*,/.exec(lineText);

		if( m ) {
			const paramType = m[1];
			const paramNumber = +m[2];

			return this.robotController.getParameterLocation( paramType, paramNumber );
		}

		return null;
	}	


	validate(): Diagnostic[] | null {

		if( !this.robotController.isParameterFileExist() ) {
			return null;
		}
		
		const diagnostics: Diagnostic[] = [];

		const textLines = this.workspace.getTextLines( this.filePath );

		textLines?.forEach( ( lineText, i ) => {
			const pattern = /^(\S+)\s*,\s*([0-9]+)\s*,\s*([-]?[0-9]+)/;
	
			const m = pattern.exec( lineText );
	
			if( m ) {
				const paramType = m[1];
				const paramNumber = +m[2];
				const paramValue = +m[3];
	
				const expectedValue = this.robotController.getParameterValue( paramType, paramNumber );
	
				const diagnosisRange = Range.create( i, m.index, i, m[0].length );
	
				if( expectedValue == undefined ) {
					diagnostics.push( {
						severity: DiagnosticSeverity.Warning,
						range: diagnosisRange,
						message: tr('pscfile.diagnostic.paramNotFound', paramType + paramNumber),//`${paramType + paramNumber} is NOT found in ALL.PRM.`,
						source: 'inform'
					} );
				}
				else if( paramValue != expectedValue ) {
					diagnostics.push( {
						severity: DiagnosticSeverity.Warning,
						range: diagnosisRange,
						message: tr('pscfile.diagnostic.paramUnmatch', paramType + paramNumber, paramValue, expectedValue),
						source: 'inform'
					} );
				}
				else {
					diagnostics.push( {
						severity: DiagnosticSeverity.Information,
						range: diagnosisRange,
						message: tr('pscfile.diagnostic.paramMatch'),
						source: 'inform'
					} );
				}
			}
		} );
	
	
		return diagnostics;
	}

	onFoldingRanges(foldingRangeParam: FoldingRangeParams): FoldingRange[] | null {
		return null;
	}
}