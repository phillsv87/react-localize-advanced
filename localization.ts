type StringMap ={}

export type DataArgs<
    T extends string|number|symbol,
    TId extends keyof StringMap
>=T extends keyof StringMap[TId] ? StringMap[TId][T] extends null?[]: [StringMap[TId][T]] : [];

export type StringsCall<T,TId extends keyof StringMap>=(key:keyof T, ...data:DataArgs<keyof T,TId>)=>string

export type KeyOrKeyAndData<T,TId extends keyof StringMap>=T extends keyof StringMap[TId] ?
    StringMap[TId][T] extends null ? T : [T,StringMap[TId][T]] : T;


export interface LocalCompProps<T,TId extends keyof StringMap>
{
    strings?:StringsCall<T,TId>;
    sk?:KeyOrKeyAndData<keyof T,TId>;
}
export interface MadeStrings<
    T extends {[key:string]:string},
    TId extends keyof StringMap
>{
    strings:StringsCall<T,TId>;
    // Text:(props:LocalTextProps<T,TId>)=>any;
    // Button:(props:LocalButtonProps<T,TId>)=>any;
}

const varsReg=/([^{]|^){([a-z0-9_:]+)\}/gi

export function makeStrings<
    T extends {[key:string]:string},
    TId extends keyof StringMap,
>(id:TId,obj:T):MadeStrings<T,TId>{
    const strings=(key:keyof T,data:any)=>{
        const str=obj[key];
        if(str===undefined || str===null){
            return str;
        }

        if(str.indexOf('{')===-1){
            return str;
        }

        let formatted='';
        let match:RegExpExecArray|null;
        let end=0;
        while(match=varsReg.exec(str)){
            const i=match.index+(match[1]?1:0);
            formatted+=str.substr(end,i-end)+(data?.[match[2]]||'');
            end=match.index+match[0].length;
        }

        formatted+=str.substr(end);

        return str.indexOf('{{')===-1?formatted:formatted.split('{{').join('{');
    }
    return {
        strings:strings as any,
        // Text:props=>LocalText({...props,strings:strings as any}),
        // Button:props=>LocalButton({...props,strings:strings as any}),
    }
}

export function convertCompString<T,TId extends keyof StringMap>(
    strings:StringsCall<T,TId>|undefined,
    sk:KeyOrKeyAndData<keyof T,TId>|undefined,
    fallback:string|null|undefined):string
{
    const func:any=strings;
    const s:string|undefined|null=(sk && func)?Array.isArray(sk)?func(sk[0],sk[1]):func(sk):undefined;
    return (s===undefined || s===null)?fallback||'':s;
}
