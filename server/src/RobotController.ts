import {
	Location,
} from 'vscode-languageserver/node';

import * as fs from 'fs';
import * as path from 'path';

import { ParameterFile } from './ParameterFile';
import { Workspace } from "./Workspace";
import * as Util from './Util';


export class RobotController {
	workspace: Workspace;
	folderPath: string;

	parameterFiles = new Map<string, ParameterFile>();

	constructor( workspace: Workspace, folderPath: string ) {
		this.workspace = workspace;
		this.folderPath = folderPath;
	}

	getParameterLocation( parameterType: string, parameterNumber: number ): Location | null {
		const parameterFilePath = path.join(this.folderPath, 'ALL.PRM');

		const file = this.getParameterFile( parameterFilePath );

		if( !file ) {
			return null;
		}

		const range = file.getParameterRange( parameterType, parameterNumber );

		if( !range ) {
			return null;
		}

		return {
			uri: Util.fsPathToUriString( parameterFilePath ),
			range: range
		};
	}


	getParameterFile( filePath: string ) {
		let file = this.parameterFiles.get( filePath );

		if( file ) {
			return file; // return cache
		}

		if( !fs.existsSync(filePath) ) {
			return undefined;
		}

		file = new ParameterFile( this.workspace, filePath );

		this.parameterFiles.set( filePath, file );

		return file;
	}

}