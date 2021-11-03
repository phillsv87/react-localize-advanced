import {useEffect, useState} from 'react';
import { NativeModules, Platform } from 'react-native';

let fallbackLang:string|null=null;

const deviceLanguage =
      ((Platform.OS === 'ios'
        ? NativeModules.SettingsManager.settings.AppleLocale ||
          NativeModules.SettingsManager.settings.AppleLanguages[0] //iOS 13
        : NativeModules.I18nManager.localeIdentifier
      ) as string).toLocaleLowerCase().split('_').join('-');

export const getDeviceLanguage=()=>deviceLanguage;

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

const keyOverrides:{[key:string]:string}={};

export function setLocalKeyOverride(key:string, value:string|null, triggerUpdate:boolean=true)
{
    if(value===null){
        delete keyOverrides[key];
    }else{
        keyOverrides[key]=value;
    }

    if(triggerUpdate){
        triggerEvent('lookup-changed');
    }
}

const activeKeys:{[key:string]:boolean}={};

const defaultLocalStringLookup:LocalStringLookup={}

export function makeStrings<
    T extends LocalStringMap,
    TSM extends TypeStringMap,
    TId extends keyof TSM
>(id:TId,obj:T):MadeStrings<T,TSM,TId>{

    for(const e in obj){
        defaultLocalStringLookup[id+'::'+e]=obj[e];
    }

    const strings=(key:keyof T,data:any)=>{

        const idKey=id+'::'+key;
        activeKeys[idKey]=true;

        const lookup=keyOverrides[idKey]||currentLookup?.[idKey];

        const str=lookup===undefined?obj[key]:lookup;

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

export function getDefaultLocalStringLookup():LocalStringLookup
{
    return {...defaultLocalStringLookup}
}

export type LocalStringLookup={[key:string]:string};

export type LocalStringLookupCb=(languages:string[])=>Promise<LocalStringLookup>;

let currentLocalStringLookupCb:LocalStringLookupCb|null=null;
let cacheUpdateIndex=0;

const localStringLookupCache:{[lng:string]:LocalStringLookup}={}
let currentLookup:LocalStringLookup|null=null;
let currentLanguage:string=deviceLanguage;

export const getLocalLookup=(id:string,key:string):string|undefined=>{
    return currentLookup?.[id+'::'+key];
}

export async function initLocals(languages:string[],fallbackLanguage:string|null,cb:LocalStringLookupCb|null)
{
    currentLanguage=languages.map(l=>l.trim().toLowerCase()).join(',');
    currentLocalStringLookupCb=cb;
    fallbackLang=fallbackLanguage;
    await updateLookupCacheAsync();
}

export async function setLocalLanguages(languages:string[])
{
    currentLanguage=languages.map(l=>l.trim().toLowerCase()).join(',');
    await updateLookupCacheAsync();
}

export function getLocalLanguages():string[]
{
    return currentLanguage?.split(',')||[];
}

export function getUserDefaultLocalLanguages():string[]
{
    return deviceLanguage?.split(',')||[];
}

export async function setLocalStringLookupCb(cb:LocalStringLookupCb|null)
{
    currentLocalStringLookupCb=cb;
    await updateLookupCacheAsync();
}


export const getFallbackLang=()=>fallbackLang;
export async function setFallbackLang(lang:string|null){
    fallbackLang=lang;
    await updateLookupCacheAsync();
}

export function addLocalCountryTags(languages:string[], addFallback:boolean):string[]
{
    const list:string[]=[];

    if(addFallback && fallbackLang && !languages.includes(fallbackLang)){
        languages=[...languages,fallbackLang];
    }

    for(const l of languages){
        list.push(l);
        const parts=l.split('-');
        if(parts.length===1){
            continue;
        }
        if(!languages.includes(parts[0])){
            list.push(parts[0]);
        }
    }

    return list;
}

export async function updateLookupCacheAsync(byPassCache:boolean=false)
{
    const index=++cacheUpdateIndex;

    const lng=currentLanguage;
    const cb=currentLocalStringLookupCb;

    if(!cb){
        return;
    }

    try{

        const cached=localStringLookupCache[lng];
        if(cached && !byPassCache){
            currentLookup=cached;
            triggerEvent('lookup-changed');
            return cached;
        }

        const lookup=await cb(addLocalCountryTags(lng.split(','),true));

        if(index!==cacheUpdateIndex){
            return;
        }

        localStringLookupCache[lng]=lookup;
        currentLookup=lookup;

        triggerEvent('lookup-changed');

    }catch(ex:any){
        console.error('Unable to update LocalString lookup',lng);
    }
}

export type LocalEventTypes='lookup-changed'|'active-check';
export type LocalEventListener=(type:LocalEventTypes)=>void;
const listeners:LocalEventListener[]=[];
export function addLocalEventListener(listener:LocalEventListener):()=>void
{
    listeners.push(listener);
    return ()=>removeLocalEventListener(listener);
}
export function removeLocalEventListener(listener:LocalEventListener)
{
    const i=listeners.indexOf(listener);
    if(i!==-1){
        listeners.splice(i,1);
    }
}
function triggerEvent(type:LocalEventTypes)
{
    for(const l of listeners){
        l(type);
    }
}

export function useLocalRenderTrigger():number
{
    const [r,render]=useState(0);

    useEffect(()=>{
        return addLocalEventListener(t=>{
            if(t==='lookup-changed' || t==='active-check'){
                render(v=>v+1);
            }
        })
    },[]);

    return r;
}

function delayAsync(delayMs:number):Promise<void>
{
    delayMs=Math.round(delayMs);
    return new Promise((r)=>{
        if(delayMs<=0){
            r();
        }else{
            setTimeout(()=>{
                r();
            },delayMs);
        }
    });
}

export async function getLocalActiveKeysAsync():Promise<string[]>
{
    for(const e in activeKeys){
        delete activeKeys[e];
    }
    triggerEvent('active-check');
    await delayAsync(200);

    const keys:string[]=[];
    for(const e in activeKeys){
        keys.push(e);
    }
    keys.sort((a,b)=>a.localeCompare(b));
    return keys;
}