const MAPBOX_VERSION='v3.33.0';
export class JourneyMap {
  constructor({container,onMessage,onPin}){this.container=container;this.onMessage=onMessage;this.onPin=onPin;this.markers=[];this.locations={};this.route=null;this.mode=null;}
  async start(config){
    if(!config.ready)return;
    try{
      if(!window.mapboxgl){
        const css=document.createElement('link');css.rel='stylesheet';css.href=`https://api.mapbox.com/mapbox-gl-js/${MAPBOX_VERSION}/mapbox-gl.css`;document.head.append(css);
        await new Promise((resolve,reject)=>{const script=document.createElement('script');script.src=`https://api.mapbox.com/mapbox-gl-js/${MAPBOX_VERSION}/mapbox-gl.js`;script.onload=resolve;script.onerror=()=>reject(new Error('The map library could not load. Check your connection.'));document.head.append(script);});
      }
      if(!window.mapboxgl.supported())throw new Error('This browser cannot display the 3D map. Route calculation and booking still work.');
      this.container.hidden=false;
      this.map=new window.mapboxgl.Map({container:this.container,accessToken:config.publicToken,style:config.style,center:[80.2707,13.0827],zoom:10,pitch:45,bearing:0,attributionControl:true});
      this.map.addControl(new window.mapboxgl.NavigationControl({visualizePitch:true}),'top-right');
      this.map.addControl(new window.mapboxgl.ScaleControl());
      this.map.on('error',()=>this.onMessage('Map tiles could not load. Check the connection and Mapbox token permissions. Route estimates remain separate.','error'));
      this.map.on('load',()=>{
        this.loaded=true;
        this.map.addSource('rkr-route',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
        this.map.addLayer({id:'rkr-route-line',type:'line',source:'rkr-route',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#b74e62','line-width':5,'line-opacity':.9}});
        if(this.map.getSource('composite'))this.map.addLayer({id:'rkr-buildings',source:'composite','source-layer':'building',filter:['==','extrude','true'],type:'fill-extrusion',minzoom:15,paint:{'fill-extrusion-color':'#b9accc','fill-extrusion-height':['get','height'],'fill-extrusion-base':['get','min_height'],'fill-extrusion-opacity':.65}});
        this.map.addSource('rkr-terrain',{type:'raster-dem',url:'mapbox://mapbox.mapbox-terrain-dem-v1',tileSize:512,maxzoom:14});
        this.map.setTerrain({source:'rkr-terrain',exaggeration:1});
        this.onMessage('', 'ready');this.draw();this.setLocations(this.locations);this.overview();
      });
      this.map.on('click',event=>{if(this.mode){const mode=this.mode;this.mode=null;this.map.getCanvas().style.cursor='';this.onPin(mode,[event.lngLat.lng,event.lngLat.lat]);}});
      this.resizeObserver=new ResizeObserver(()=>this.map.resize());this.resizeObserver.observe(this.container);
    }catch(error){this.container.hidden=true;this.onMessage(error.message,'unavailable');}
  }
  setLocations(locations){
    this.locations=locations;if(!this.map)return;
    this.markers.forEach(m=>m.remove());this.markers=[];
    for(const [key,label] of [['pickup','RKR · Pickup'],['destination','RKR · Drop-off']]){
      if(!locations[key])continue;const el=document.createElement('div');el.className=`rkr-map-marker ${key}`;el.textContent=label;
      this.markers.push(new window.mapboxgl.Marker({element:el}).setLngLat(locations[key].coordinates).addTo(this.map));
    }
  }
  showCurrent(coordinates){if(!this.map)return;this.current?.remove();const el=document.createElement('div');el.className='rkr-map-marker current';el.textContent='You are here';this.current=new window.mapboxgl.Marker({element:el}).setLngLat(coordinates).addTo(this.map);}
  setRoute(route){this.route=route;this.draw();if(route)this.overview();}
  draw(){if(!this.loaded)return;this.map.getSource('rkr-route')?.setData({type:'FeatureCollection',features:this.route?[this.route.outbound,this.route.inbound].filter(Boolean).map(r=>({type:'Feature',properties:{},geometry:r.geometry})):[]});}
  overview(){if(!this.loaded||!this.route)return;const bounds=new window.mapboxgl.LngLatBounds();for(const leg of [this.route.outbound,this.route.inbound].filter(Boolean))for(const point of leg.geometry.coordinates)bounds.extend(point);this.map.fitBounds(bounds,{padding:55,maxZoom:15,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:700});}
  tilt(enabled){if(this.map)this.map.easeTo({pitch:enabled?55:0,bearing:enabled?-15:0,duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:600});}
  setPinMode(mode){this.mode=mode;if(this.map)this.map.getCanvas().style.cursor='crosshair';}
}
