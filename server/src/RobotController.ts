import {
	Location,
} from 'vscode-languageserver/node';

import * as fs from 'fs';
import * as path from 'path';

import { Workspace } from "./Workspace";
import * as Util from './Util';

import { JbiFile } from './JbiFile';
import { ParameterFile } from './ParameterFile';
import { VarDatFile } from './VarDatFile';
import { IoNameDatFile } from './IoNameDatFile';
import { IoMNameDatFile } from './IoMNameDatFile';
import { PscFile } from './PscFile';

export class RobotController {
	private workspace: Workspace;
	private folderPath: string;

	// files
	private jbiFiles = new Map<string, JbiFile>();
	private parameterFiles = new Map<string, ParameterFile>();
	private varDatFiles = new Map<string, VarDatFile>();
	private ioNameDatFiles = new Map<string, IoNameDatFile>();
	private ioMNameDatFiles = new Map<string, IoMNameDatFile>();
	private pscFiles = new Map<string, PscFile>();

	constructor( workspace: Workspace, folderPath: string ) {
		this.workspace = workspace;
		this.folderPath = folderPath;
	}

	isJbiFileExist( jobName: string ) {
		return fs.existsSync( this.getJbiFilePath(jobName) );
	}

	isParameterFileExist() {
		const parameterFilePath = path.join(this.folderPath, 'ALL.PRM');
		return fs.existsSync( parameterFilePath );
	}

	getJbiFilePath( jobName: string ) {
		return path.join(this.folderPath, jobName + ".JBI");
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


	// files
	getJbiFile( filePath: string ) {
		let file = this.jbiFiles.get( filePath );

		if( file ) {
			return file; // return cache
		}

		if( !fs.existsSync(filePath) ) {
			return undefined;
		}

		file = new JbiFile( this.workspace, this, filePath );

		this.jbiFiles.set( filePath, file );

		return file;
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

	getIoNameDatFile( filePath: string ) {
		let file = this.ioNameDatFiles.get( filePath );

		if( file ) {
			return file; // return cache
		}

		if( !fs.existsSync(filePath) ) {
			return undefined;
		}

		file = new IoNameDatFile( this.workspace, filePath );

		this.ioNameDatFiles.set( filePath, file );

		return file;

	}

	getIoMNameDatFile( filePath: string ) {
		let file = this.ioMNameDatFiles.get( filePath );

		if( file ) {
			return file; // return cache
		}

		if( !fs.existsSync(filePath) ) {
			return undefined;
		}

		file = new IoMNameDatFile( this.workspace, filePath );

		this.ioMNameDatFiles.set( filePath, file );

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