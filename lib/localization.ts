export type DataArgs<
    T extends string|number|symbol,
    TSM extends TypeStringMap,
    TId extends keyof TSM
>=T extends keyof TSM[TId] ? TSM[TId][T] extends null?[]: [TSM[TId][T]] : [];

export type StringsCall<
    T extends LocalStringMap,
    TSM extends TypeStringMap,
    TId extends keyof TSM
>=(key:keyof T, ...data:DataArgs<keyof T,TSM,TId>)=>string

export type KeyOrKeyAndData<
    T,
    TSM extends TypeStringMap,
    TId extends keyof TSM
>=T extends keyof TSM[TId] ?
    TSM[TId][T] extends null ? T : [T,TSM[TId][T]] : T;


export interface LocalCompProps<
    T extends LocalStringMap,
    TSM extends TypeStringMap,
    TId extends keyof TSM
>
{
    strings?:StringsCall<T,TSM,TId>;
    sk?:KeyOrKeyAndData<keyof T,TSM,TId>;
}
export interface MadeStrings<
    T extends LocalStringMap,
    TSM extends TypeStringMap,
    TId extends keyof TSM
>{
    strings:StringsCall<T,TSM,TId>;
}

const varsReg=/([^{]|^){([a-z0-9_:]+)\}/gi

export type LocalStringMap={[name:string]:string}

export type TypeStringMap={
    [id:string]:{
        [name:string]:any;
    }
}

export function makeStrings<
    T extends LocalStringMap,
    TSM extends TypeStringMap,
    TId extends keyof TSM
>(id:TId,obj:T):MadeStrings<T,TSM,TId>{
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
    return {strings:strings as any}
}

export function convertCompString<
    T extends LocalStringMap,
    TSM extends TypeStringMap,
    TId extends keyof TSM,
>(
    strings:StringsCall<T,TSM,TId>|undefined,
    sk:KeyOrKeyAndData<keyof T,TSM,TId>|undefined,
    fallback:string|null|undefined):string
{
    const func:any=strings;
    const s:string|undefined|null=(sk && func)?Array.isArray(sk)?func(sk[0],sk[1]):func(sk):undefined;
    return (s===undefined || s===null)?fallback||'':s;
}
