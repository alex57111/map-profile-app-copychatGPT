// Telegram Mini App bridge.
// Native geolocation uses LocationManager (Bot API 8.0+) after explicit user consent.

import type { GPSPosition } from '../types/geo'

interface TelegramLocationData { latitude:number; longitude:number; altitude?:number|null; course?:number|null; speed?:number|null; horizontal_accuracy?:number|null }
interface TelegramLocationManager { isInited:boolean; isLocationAvailable:boolean; isAccessRequested:boolean; isAccessGranted:boolean; init:(callback?:()=>void)=>TelegramLocationManager; getLocation:(callback:(location:TelegramLocationData|null)=>void)=>TelegramLocationManager; openSettings?:()=>TelegramLocationManager }

export interface TelegramWebApp {
  initData:string; initDataUnsafe:Record<string,unknown>; version?:string; platform?:string; colorScheme:'light'|'dark'; themeParams:Record<string,string>; viewportHeight:number
  ready:()=>void; expand:()=>void; close:()=>void
  onEvent:(eventType:string, callback:(...args:any[])=>void)=>void
  offEvent:(eventType:string, callback:(...args:any[])=>void)=>void
  isVersionAtLeast?: (version:string)=>boolean
  LocationManager?: TelegramLocationManager
}

declare global { interface Window { Telegram?: { WebApp?: TelegramWebApp } } }

export function getTelegramWebApp():TelegramWebApp|null { return window.Telegram?.WebApp ?? null }
export function isInsideTelegram():boolean { const wa=getTelegramWebApp(); return !!wa && typeof wa.initData==='string' && wa.initData.length>0 }
export function getInitData():string { return getTelegramWebApp()?.initData ?? '' }
export function initTelegramWebApp():void { const wa=getTelegramWebApp(); if(!wa)return; try{wa.ready();wa.expand()}catch{} }

export function requestTelegramLocation():Promise<GPSPosition|null> {
  const manager=getTelegramWebApp()?.LocationManager
  if(!manager)return Promise.resolve(null)
  return new Promise(resolve=>{
    const finish=(d:TelegramLocationData|null)=>resolve(d?{lat:d.latitude,lng:d.longitude,heading:d.course??0,speed:d.speed??0,accuracy:d.horizontal_accuracy??0,timestamp:Date.now()}:null)
    try {
      const start=()=>{ try{manager.getLocation(finish)}catch{resolve(null)} }
      if(manager.isInited) start(); else manager.init(start)
    } catch { resolve(null) }
  })
}

export function closeTelegramWebApp():boolean { const wa=getTelegramWebApp(); if(!wa?.close)return false; try{wa.close();return true}catch{return false} }
