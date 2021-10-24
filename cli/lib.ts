
import child_process from 'child_process';

export function buildArgs(argv:string[]):{[key:string]:string}
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
export function exec(cmd:string):{code:number,output:string}
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