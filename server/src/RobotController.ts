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
import { VarNameDatFile } from './VarNameDatFile';

export class RobotController {
	private workspace: Workspace;
	private folderPath: string;
	private options = new RobotControllerOptions(this);

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

	/**
	 * get file path
	 * @param fileName 
	 * @returns filePath
	 */
	getFilePath( fileName: string ) {
		return path.join(this.folderPath, fileName);
	}

	getJbiFilePath( jobName: string ) {
		return path.join(this.folderPath, jobName + ".JBI");
	}

	/**
	 * Get Job Names in the controller
	 * @returns job names
	 */
	getJobNameList() : string[] {
		const jbiFiles = fs.readdirSync( this.folderPath ).filter( (name) => {
			return fs.statSync( path.join( this.folderPath, name ) ).isFile()
				&& path.extname( name ).toUpperCase() == ".JBI";
		} );

		const jobNames = jbiFiles.map( name => {
			return path.parse( name ).name;
		});

		return jobNames;
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

	getIoNameLocation( logicalIoNumber: number ): Location | null {
		const ioNameFiles = ["IONAME.DAT", "EXIONAME.DAT"];

		for( let i = 0; i < ioNameFiles.length; i++ ) {
			const ioNameFilePath = path.join(this.folderPath, ioNameFiles[i]);
			const file = this.getIoNameDatFile( ioNameFilePath );
			const ioNameRange = file?.getIoNameRange(logicalIoNumber);

			if( ioNameRange ) {
				// io name found
				return {
					uri: Util.fsPathToUriString( ioNameFilePath ),
					range: ioNameRange
				};
			}
		}

		return null;

	}

	getVarNameLocation( varType: string, varNumber: number ): Location | null {
		const varNameFilePath = path.join(this.folderPath, 'VARNAME.DAT');

		const file = this.getVarNameDatFile( varNameFilePath );

		if( !file ) {
			return null;
		}

		const range = file.getVarNameRange( varType, varNumber );

		if( !range ) {
			return null;
		}

		return {
			uri: Util.fsPathToUriString( varNameFilePath ),
			range: range
		};
	}

	/**
	 * get variable name
	 * @param varType variable type
	 * @param varNumber variable number
	 * @returns variable name
	 */
	getVarname( varType: string, varNumber: number ): string | undefined {
		const varNameFilePath = path.join(this.folderPath, "VARNAME.DAT" );
		const file = this.getVarNameDatFile( varNameFilePath );

		return file?.getVarName( varType, varNumber );
	}

	/**
	 * Get Io name from logical Io number.
	 * @param logicalIoNumber e.g. 10010, 30010
	 * @returns ioName
	 */
	getIoName( logicalIoNumber: number ): string | undefined {
		const ioNameFiles = ["IONAME.DAT", "EXIONAME.DAT"];

		let ioName: string | undefined;

		for( let i = 0; i < ioNameFiles.length; i++ ) {
			const ioNameFilePath = path.join(this.folderPath, ioNameFiles[i]);
			const file = this.getIoNameDatFile( ioNameFilePath );

			ioName = file?.getIoName(logicalIoNumber);

			if( ioName ) {
				// io name found
				break;
			}
		}

		return ioName;
	}

	getOptions() {
		return this.options;
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

		const fileName = path.basename( filePath );
		const extname = path.extname(fileName).toUpperCase();


		if( extname === ".JBI" ) {
			file = new JbiFile( this, filePath );
		}
		else if( extname === ".PRM" ) {
			file = new ParameterFile( this, filePath );
		}
		else if( fileName == "VAR.DAT") {
			file = new VarDatFile( this, filePath );
		}
		else if( fileName == "VARNAME.DAT" ) {
			file = new VarNameDatFile( this, filePath );
		}
		else if( fileName == "IONAME.DAT" || fileName == "EXIONAME.DAT" ) {
			file = new IoNameDatFile( this, filePath );
		}
		else if( fileName == "IOMNAME.DAT") {
			file = new IoMNameDatFile( this, filePath );
		}
		else if( extname == ".PSC") {
			file = new PscFile( this, filePath );
		}
		else {
			file = new RobotControllerFile( this, filePath );
		}

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
			return file as VarDatFile; // return cache
		}

		if( !fs.existsSync(filePath) ) {
			return undefined;
		}

		file = new VarDatFile( this, filePath );

		this.robotControllerFiles.set( filePath, file );

		return file as VarDatFile;

	}

	getVarNameDatFile( filePath: string ) : VarNameDatFile | undefined {
		let file = this.robotControllerFiles.get( filePath );

		if( file ) {
			return file as VarNameDatFile; // return cache
		}

		if( !fs.existsSync(filePath) ) {
			return undefined;
		}

		file = new VarNameDatFile( this, filePath );

		this.robotControllerFiles.set( filePath, file );

		return file as VarNameDatFile;

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

class RobotControllerOptions {
	robotController: RobotController;

	constructor( robotController: RobotController ) {
		this.robotController = robotController;
	}

	/**
	 * Check IO name alias function
	 * @returns: io name alias function is enabled
	 * @return undefined: unknown. 
	 */
	isIoNameAliasEnabled() : boolean | undefined {
		const value = this.robotController.getParameterValue( "S2C", 395 );

		if( value != undefined || value != null ) {
			return value > 0;
		}
		return undefined;
	}

	/**
	 * Check Variable name alias function
	 * @returns: Variable name alias function is enabled
	 * @return undefined: unknown. 
	 */
	isVarNameAliasEnabled() : boolean | undefined {
		const value = this.robotController.getParameterValue( "S2C", 396 );

		if( value != undefined || value != null ) {
			return value > 0;
		}
		return undefined;
	}
}