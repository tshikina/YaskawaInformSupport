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
import { RobotControllerFile } from './RobotControllerFile';

export class RobotController {
	private workspace: Workspace;
	private folderPath: string;

	// files
	private robotControllerFiles = new Map<string, RobotControllerFile>();

	constructor( workspace: Workspace, folderPath: string ) {
		this.workspace = workspace;
		this.folderPath = folderPath;
	}

	getWorkspace() : Workspace {
		return this.workspace;
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
	getFile( filePath: string ) : RobotControllerFile | undefined {
		let file = this.robotControllerFiles.get( filePath );

		if( file ) {
			return file; // return cache
		}

		if( !fs.existsSync(filePath) ) {
			return undefined;
		}

		file = new RobotControllerFile( this, filePath );

		this.robotControllerFiles.set( filePath, file );

		return file;
	}

	getJbiFile( filePath: string ) : JbiFile | undefined {
		let file = this.robotControllerFiles.get( filePath );

		if( file ) {
			return file as JbiFile; // return cache
		}

		if( !fs.existsSync(filePath) ) {
			return undefined;
		}

		file = new JbiFile( this, filePath );

		this.robotControllerFiles.set( filePath, file );

		return file as JbiFile;
	}

	getParameterFile( filePath: string ) : ParameterFile | undefined {
		let file = this.robotControllerFiles.get( filePath );

		if( file ) {
			return file as ParameterFile; // return cache
		}

		if( !fs.existsSync(filePath) ) {
			return undefined;
		}

		file = new ParameterFile( this, filePath );

		this.robotControllerFiles.set( filePath, file );

		return file as ParameterFile;
	}

	getVarDatFile( filePath: string ) : VarDatFile | undefined {
		let file = this.robotControllerFiles.get( filePath );

		if( file ) {
			return file; // return cache
		}

		if( !fs.existsSync(filePath) ) {
			return undefined;
		}

		file = new VarDatFile( this, filePath );

		this.robotControllerFiles.set( filePath, file );

		return file as VarDatFile;

	}

	getIoNameDatFile( filePath: string ) : IoNameDatFile | undefined {
		let file = this.robotControllerFiles.get( filePath );

		if( file ) {
			return file as IoNameDatFile; // return cache
		}

		if( !fs.existsSync(filePath) ) {
			return undefined;
		}

		file = new IoNameDatFile( this, filePath );

		this.robotControllerFiles.set( filePath, file );

		return file as IoNameDatFile;

	}

	getIoMNameDatFile( filePath: string ) : IoMNameDatFile | undefined {
		let file = this.robotControllerFiles.get( filePath );

		if( file ) {
			return file as IoMNameDatFile; // return cache
		}

		if( !fs.existsSync(filePath) ) {
			return undefined;
		}

		file = new IoMNameDatFile( this, filePath );

		this.robotControllerFiles.set( filePath, file );

		return file as IoMNameDatFile;

	}

	getPscFile( filePath: string ) : PscFile | undefined {
		let file = this.robotControllerFiles.get( filePath );

		if( file ) {
			return file as PscFile; // return cache
		}

		if( !fs.existsSync(filePath) ) {
			return undefined;
		}

		file = new PscFile( this, filePath );

		this.robotControllerFiles.set( filePath, file );

		return file as PscFile;

	}

	clearFileCache( filePath: string ){
		this.robotControllerFiles.delete( filePath );
	}

}