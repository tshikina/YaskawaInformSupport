import {
	Location,
} from 'vscode-languageserver/node';

import * as fs from 'fs';
import * as path from 'path';

import { Workspace } from "./Workspace";
import * as Util from './Util';

import { ParameterFile } from './ParameterFile';
import { PscFile } from './PscFile';

export class RobotController {
	workspace: Workspace;
	folderPath: string;

	parameterValueMap: Map<string, number> | null = null; // <parameterNumber, value>

	// files
	parameterFiles = new Map<string, ParameterFile>();
	pscFiles = new Map<string, PscFile>();

	constructor( workspace: Workspace, folderPath: string ) {
		this.workspace = workspace;
		this.folderPath = folderPath;
	}

	isParameterFileExist() {
		const parameterFilePath = path.join(this.folderPath, 'ALL.PRM');
		return fs.existsSync( parameterFilePath );
	}

	/**
	 * Get parameter value
	 * 
	 * @param parameterType 
	 * @param parameterNumber 
	 * @returns number: parameter value
	 * @return undefined: out of range
	 * @return null: file is not found
	 */
	getParameterValue( parameterType: string, parameterNumber: number ): number | null | undefined {
		const parameterFilePath = path.join(this.folderPath, 'ALL.PRM');
		const file = this.getParameterFile( parameterFilePath );

		if( !file ) {
			return null;
		}

		if( !this.parameterValueMap ) {
			this.parameterValueMap = file.getParameterValueMap();		
		}

		if( !file.isParameterExist( parameterType, parameterNumber ) ) {
			return undefined;
		}
		
		const value = this.parameterValueMap?.get( parameterType + parameterNumber );

		return value ? value : 0;
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

	getPscFile( filePath: string ) {
		let file = this.pscFiles.get( filePath );

		if( file ) {
			return file; // return cache
		}

		if( !fs.existsSync(filePath) ) {
			return undefined;
		}

		file = new PscFile( this.workspace, this, filePath );

		this.pscFiles.set( filePath, file );

		return file;

	}

}