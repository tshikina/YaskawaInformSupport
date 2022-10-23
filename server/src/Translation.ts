import * as fs from "fs";
import path = require('path');


let currentLocale = "";
const tranlationTable = new Map<string, string>();

export function initTranslation( locale: string ) {
	const langFolderPath = path.join(__dirname, "..", "..", "resources", "lang");
	currentLocale = locale;
	const englishPath = path.join(langFolderPath, "translation" + "_" + "en" + ".json");
	const translationPath = path.join(langFolderPath, "translation" + "_" + locale + ".json");

	if( fs.existsSync(englishPath) ) {
		try{
			const obj = JSON.parse( fs.readFileSync( englishPath, "utf-8" ) );
			updateTable(obj);
		}
		catch(err) {
			console.error( `cannot read file: ${englishPath}` );
		}
	}
	else
		console.error( `translation file is not exist: ${englishPath}` );

	if( englishPath != translationPath ) {
		if( fs.existsSync(translationPath) ) {
			try{
				const obj = JSON.parse( fs.readFileSync( translationPath, "utf-8" ) );
				updateTable(obj);
			}
			catch(err) {
				console.error( `cannot read file: ${translationPath}` );
			}
		}	
		else
			console.error( `translation file is not exist: ${translationPath}` );
	}
}

function updateTable( obj : any ) {
	for( const [key, value] of Object.entries(obj) ) {
		if( typeof(value) === "string" ) {
			// console.log(`add translation: ${key}: ${value}`);
			tranlationTable.set(key, value);
		}
	}
}

function format( str: string, ...values: any[]): string {

	const formatStr: string = str.replace( /{([0-9]+)}/g, (match, args) => {
		const index = args[0];
		if( index >= 0 && index < values.length) {
			return values[index];			
		}
		return match;
	});

	return formatStr;
}

export function translate( key: string, ...values: any[] ) : string {
	const str = tranlationTable.get(key);

	if( str ) {
		return format( str, ...values );
	}

	return key;
}
