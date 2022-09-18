import {
	Range,
	Hover,
	HoverParams,
	Diagnostic,
	DiagnosticSeverity,
	DefinitionParams,
	Location,
} from 'vscode-languageserver/node';

import {
	Workspace,
} from "./Workspace";

import { RobotController } from './RobotController';

export class PscFile {
	workspace: Workspace;
	robotController: RobotController;
	filePath: string;

	constructor( workspace: Workspace, robotController: RobotController, filePath: string ) {
		this.workspace = workspace;
		this.robotController = robotController;
		this.filePath = filePath;
	}

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
		} );
	
	
		return diagnostics;
	}
}