import {
	Location,
} from 'vscode-languageserver/node';

import * as fs from 'fs';
import * as path from 'path';

import { Workspace } from "./Workspace";
import * as Util from './Util';

import { ParameterFile } from './ParameterFile';
import { VarDatFile } from './VarDatFile';
import { PscFile } from './PscFile';

export class RobotController {
	private workspace: Workspace;
	private folderPath: string;

	// files
	private parameterFiles = new Map<string, ParameterFile>();
	private varDatFiles = new Map<string, VarDatFile>();
	private pscFiles = new Map<string, PscFile>();

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

		return file.getParameterValue( parameterType, parameterNumber );
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

	getVarDatFile( filePath: string ) {
		let file = this.varDatFiles.get( filePath );

		if( file ) {
			return file; // return cache
		}

		if( !fs.existsSync(filePath) ) {
			return undefined;
		}

		file = new VarDatFile( this.workspace, filePath );

		this.varDatFiles.set( filePath, file );

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