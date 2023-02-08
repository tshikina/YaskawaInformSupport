import * as fs from "fs";
import path = require('path');


const supportLocales = new Set(["en", "ja"]);
const tranlationTable = new Map<string, Map<string, string>>(); // <lang, <key, value>>

export function initTranslation() {
	const langFolderPath = path.join(__dirname, "..", "..", "resources", "lang");
	for( const locale of supportLocales.keys() ){
		const translationPath = path.join(langFolderPath, "translation" + "_" + locale + ".json");

		if( fs.existsSync(translationPath) ) {
			if( !tranlationTable.get(locale) ) {
				tranlationTable.set( locale, new Map<string, string>() );
			}
	
			try{
				const obj = JSON.parse( fs.readFileSync( translationPath, "utf-8" ) );
				updateTable(locale, obj);
			}
			catch(err) {
				console.error( `cannot read file: ${translationPath}` );
			}
		}	
		else
			console.error( `translation file is not exist: ${translationPath}` );

	}
}

export function isLocaleSupported( locale: string ){
	return supportLocales.has( locale );
}

export function getSupportedLocales(): string[] {
	return [...supportLocales];
}

export function hasTranslation( locale: string, key: string ): boolean {
	const table = tranlationTable.get(locale);

	if( !table ) {
		return false;
	}

	return table.has(key);
}

function updateTable( locale: string, obj: any ) {
	for( const [key, value] of Object.entries(obj) ) {
		if( typeof(value) === "string" ) {
			// console.log(`add translation: ${key}: ${value}`);
			tranlationTable.get(locale)?.set(key, value);
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

export function translate( locale: string, key: string, ...values: any[] ) : string {
	let str = tranlationTable.get(locale)?.get(key);

	// if str is not found, try to search in English
	if( str == undefined ) {
		str = tranlationTable.get("en")?.get(key);
	}

	if( str != undefined ) {
		return format( str, ...values );
	}

	return key;
}
