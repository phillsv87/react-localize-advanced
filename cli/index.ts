import * as fs from 'fs';
import Path from 'path';
import JSON5 from 'json5';
import child_process from 'child_process';

function buildArgs(argv:string[]):{[key:string]:string}
{
    const args:{[key:string]:string}={};
    for(let i=2;i<argv.length;i++){
        const e=argv[i];
        if(e.startsWith('-')){
            args[e.substr(1)]=argv[i+1]?.startsWith('-')?'true':(argv[i+1]||'true');
        }
    }
    return args;
}
function exec(cmd:string):{code:number,output:string}
{
    try{
        const output=child_process.execSync(cmd,{stdio:'pipe'});
        return {
            code:0,
            output:output.toString()
        }
    }catch(ex:any){
        return {
            code:Number(ex.status),
            output:''
        }
    }
}

const sourceExts=['.ts','.tsx','.js','.jsx'];

interface ArgTypes
{
    source?:string; // path to source files
    out?:string; // path to output declarations
    metadataOut?:string; // path to write metadata json to
    git?:'true'|'false'; // obey git tracking
    mod?:'true'|'false'; // only check modified files
}

const defaultArgs:Required<ArgTypes>={
    source:'',
    out:'',
    metadataOut:'',
    git:'false',
    mod:'false'
}

const args:Required<ArgTypes>={...defaultArgs,...buildArgs(process.argv)};

if(!args.source){
    throw new Error('-source required');
}

if(!args.out){
    throw new Error('-out required');
}

process.chdir(args.source);

const onlyMod=args.mod==='true';
let gitFiles:string[]|null=null;

function shouldIgnore(path:string,dir:boolean)
{
    if(args.git!=='true'){
        return false;
    }

    if(gitFiles===null){
        gitFiles=exec('git ls-files'+(onlyMod?' -m':'')).output.split('\n').map(l=>Path.join(args.source||'',l));
    }

    if(gitFiles.includes(path)){
        return false;
    }

    if(onlyMod && !dir){
        return true;
    }

    const {code}=exec(`git check-ignore '${path}'`);
    return code!==1;
}


function processDir(path:string)
{
    if(shouldIgnore(path,true)){
        return;
    }
    const paths=fs.readdirSync(path);

    for(const fileName of paths){
        if(fileName.startsWith('.') || fileName==='node_modules'){
            continue;
        }
        const fPath=Path.join(path,fileName);
        const stat=fs.lstatSync(fPath);
        if(stat.isFile() && sourceExts.includes(Path.extname(fileName).toLowerCase())){
            processFile(fPath);
        }else if(stat.isDirectory()){
            processDir(fPath);
        }
    }
}

const makeStringRef=/makeStrings\s*\(\s*['"]([a-zA-Z][\w]*)['"]\s*,\s*\{/g

function processFile(path:string)
{
    if(shouldIgnore(path,false)){
        return;
    }

    let content=fs.readFileSync(path).toString();
    let match:RegExpExecArray|null;
    
    while(match=makeStringRef.exec(content)){
        const start=content.indexOf('{',match.index);
        let end=content.indexOf('}',start);
        while(true){

            if(end===-1){
                throw new Error('End of makeStrings expected. file='+path)
            }

            try{
                const strings=JSON5.parse(content.substr(start,end-start+1));
                appendStrings(path,match[1],strings);
                break;
            }catch{}
            
            end=content.indexOf('}',end+1);
        }
    }


}

const keys:string[]=[];
interface StringEntry
{
    key:string;
    text:string;
    vars?:{[name:string]:string}
}
interface StringsBundle
{
    id:string;
    strings:{[key:string]:StringEntry}
}
type BundleMap=
{
    [id:string]:StringsBundle
}
const bundleMap:BundleMap={}

const varsReg=/([^{]|^){([a-z0-9_:]+)\}/gi

function appendStrings(path:string,id:string,strings:{[key:string]:string})
{
    if(bundleMap[id]){
        console.warn(`Duplicate makeStrings id. id=${id}, path=${path}`);
    }

    const bundle:StringsBundle=bundleMap[id]={
        id,
        strings:{}
    }


    for(const e in strings){
        const text=strings[e];
        const str:StringEntry=bundle.strings[e]={
            key:e,
            text
        }
        let match:RegExpExecArray|null;
        while(match=varsReg.exec(text)){
            if(!str.vars){
                str.vars={}
            }
            const parts=match[2].split(':');
            const name=parts[0];
            if(!str.vars[name]){
                str.vars[name]=parts[1]||'string';
            }
        }
    }
}

processDir(args.source);

const stringVars:string[]=[];
function processStringVars()
{
    for(const id in bundleMap){

        const bundle=bundleMap[id];
        stringVars.push('    '+id+':{');

        for(const name in bundle.strings){
            const entry=bundle.strings[name];
            if(entry.vars){
                stringVars.push('        '+name+':{');
                for(const varE in entry.vars){
                    stringVars.push(`            ${varE}:${entry.vars[varE]};`);
                }
                stringVars.push('        }');
            }else{
                stringVars.push('        '+name+':null;');
            }
        }

        stringVars.push('    }')


    }
}
processStringVars();



fs.writeFileSync(args.out,`// this file was generated by react-localize-advanced
export type StringMap={
${stringVars.join('\n')}
}
`)

if(args.metadataOut){
    fs.writeFileSync(args.metadataOut,JSON.stringify(bundleMap,null,4))
}