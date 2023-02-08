import * as fs from "fs";
import path = require('path');
import * as Translation from './Translation';

interface InformData {
	detail: string,
	showDescription: boolean
}

const commandTable = new Map<string, InformData>(); // <key, value>

export function initInform() {
	const folderPath = path.join(__dirname, "..", "..", "resources", "inform");
	const dataPath = path.join(folderPath, "informCommands.json");

	if( fs.existsSync(dataPath) ) {
		try{
			const obj = JSON.parse( fs.readFileSync( dataPath, "utf-8" ) );
			updateTable( obj );
		}
		catch(err) {
			console.error( `cannot read file: ${dataPath}` );
		}
	}	
	else
		console.error( `inform file is not exist: ${dataPath}` );
}

function updateTable( obj: any ) {
	for( const [key, value] of Object.entries(obj) ) {
		if( value && typeof(value) === "object" ) {
			const data: InformData = {
				detail: "",
				showDescription: true
			};

			for( const [key2,value2] of Object.entries(value)) {
				switch( key2 ) {
					case "detail": data.detail = value2; break;
					case "showDescription": data.showDescription = value2; break;
				}

			}
			commandTable.set(key, data);
		}
	}
}

/**
 * check string is command
 */
export function isCommandStr( str: string ) {
	return commandTable.get( str ) != undefined;
}


export function getDetailCommand( commandStr: string ){
	const commandData = commandTable.get( commandStr );

	if( !commandData ) {
		return "";
	}

	return commandData.detail;
}


export function getCommandDescription( locale: string, commandStr: string ){
	const commandData = commandTable.get( commandStr );

	if( !commandData ) {
		return "";
	}

	if( !commandData.showDescription ) {
		return "";
	}

	const trKey = "inform.description." + commandStr;
	return Translation.translate( locale, trKey );	
}

export function printUnknownDescription( locale: string ) {
	commandTable.forEach( ( commandData, commandStr ) => {
		if( !commandData.showDescription || commandStr == "" ) {
			return;
		}

		const trKey = "inform.description." + commandStr;
		if( !Translation.hasTranslation( locale, trKey ) ) {
			console.debug( `'${commandStr}' does not have description in '${locale}'` );
		}
	} );
}