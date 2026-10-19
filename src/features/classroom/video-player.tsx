'use client';
import { useEffect, useRef, useState } from 'react';
import { mutate } from '@/lib/http';
import { useLoginRedirect } from '@/features/auth';
import styles from './classroom.module.css';
type PlayerEvent={seconds:number};
type Player={on:(event:string,fn:(data:PlayerEvent)=>void)=>void;destroy:()=>Promise<void>};
type Vimeo={Player:new(container:HTMLElement,options:{url:string;width:number;height:number})=>Player};
let sdk:Promise<Vimeo>|undefined;
function loadVimeo() {
  return sdk ??= new Promise<Vimeo>((resolve,reject)=>{
    const script=document.createElement('script');script.src='https://player.vimeo.com/api/player.js';
    script.onload=()=>{ const value=(window as Window & {Vimeo?:Vimeo}).Vimeo;if(value) resolve(value);else reject(new Error('Video SDK unavailable')); };
    script.onerror=()=>{sdk=undefined;script.remove();reject(new Error('Video SDK unavailable'));};document.head.append(script);
  });
}
export function VideoPlayer({orderId,lessonId}:{orderId:string;lessonId:string}) {
  const container=useRef<HTMLDivElement>(null),[failed,setFailed]=useState(false);
  const { redirectIfUnauthorized } = useLoginRedirect();
  useEffect(()=>{
    let active=true,player:Player|undefined,playing=false,seeking=false,sequence=0,lastSent=0,queue=Promise.resolve();
    async function start() {
      const session=await mutate<{sessionId:string;url:string}>('playback',{orderId,lessonId});
      const vimeo=await loadVimeo();if(!active||!container.current) return;
      player=new vimeo.Player(container.current,{url:session.url,width:1100,height:619});
      function send(seconds:number,count:boolean) {
        if(!active) return;
        const input={sessionId:session.sessionId,sequence:++sequence,position:Math.floor(seconds),playing:count};lastSent=performance.now();
        queue=queue.then(async()=> { if(active) await mutate('playback/progress',input); }).catch(error=>{if(active){active=false;if(!redirectIfUnauthorized(error)) setFailed(true);}});
      }
      player.on('playing',()=>{playing=true;});
      player.on('seeking',()=>{seeking=true;});
      player.on('seeked',e=>{seeking=false;send(e.seconds,false);});
      player.on('timeupdate',e=>{if(!seeking && performance.now()-lastSent>=5000) send(e.seconds,playing);});
      player.on('pause',e=>{send(e.seconds,playing&&!seeking);playing=false;});
      player.on('ended',e=>{send(e.seconds,playing&&!seeking);playing=false;});
      player.on('error',()=>{if(active) setFailed(true);});
    }
    void start().catch(error=>{if(active && !redirectIfUnauthorized(error)) setFailed(true);});
    return ()=>{active=false;void player?.destroy();};
  },[orderId,lessonId,redirectIfUnauthorized]);
  return failed ? <div className={styles.videoEmpty}><div><p>수강 권한을 확인하지 못했습니다.</p><button onClick={()=>location.reload()}>다시 시도</button></div></div> : <div ref={container} className={styles.poster} />;
}
