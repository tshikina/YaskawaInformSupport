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

export class CioPrgLstFile extends RobotControllerFile {

	onHover(hoverParams: HoverParams): Hover | null {
		const pos = hoverParams.position;
	
		const str = this.workspace.getTextLine(this.filePath, pos.line);

		if( !str ) {
			return null;
		}

		const m = /#([0-9]{5})\b/.exec(str);

		if( m ) {
			const logicalIoNumber = +m[1];
			const ioName = this.robotController.getIoName( logicalIoNumber );

			if( ioName ) {
				return {
					contents: [`${ioName}`]
				};
			}
		}
		else {
			// console.log("parameter not match: " + str);

		}

		return null;
	}
}