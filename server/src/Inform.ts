import * as fs from "fs";
import path = require('path');
import * as Translation from './Translation';

interface InformData {
	detail: string
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
				detail: ""
			};

			for( const [key2,value2] of Object.entries(value)) {
				if( key2 == "detail" ) {
					data.detail = value2;
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


export function getCommandDescription( locale: string, commandStr: string ){
	const trKey = "inform.description." + commandStr;
	return Translation.translate( locale, trKey );
}