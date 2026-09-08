import React, { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface LeafletMapProps {
  currentLocation: { latitude: number; longitude: number } | null;
  routeCoordinates?: { latitude: number; longitude: number }[];
  height?: number;
}

export default function LeafletMap({ currentLocation, routeCoordinates = [], height }: LeafletMapProps) {
  const webViewRef = useRef<WebView>(null);

  // Jika tidak ada lokasi, tampilkan view kosong
  if (!currentLocation) return <View style={[styles.container, height ? { height } : {}]} />;

  const lat = currentLocation.latitude;
  const lng = currentLocation.longitude;
  const polylineCoords = JSON.stringify(routeCoordinates.map(c => [c.latitude, c.longitude]));

  // Membangun file HTML untuk Leaflet
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <style>
          body { padding: 0; margin: 0; }
          html, body, #map { height: 100%; width: 100vw; }
          /* Menyembunyikan atribusi agar lebih bersih */
          .leaflet-control-attribution { display: none; }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script>
          var map = L.map('map', {
            zoomControl: false
          }).setView([${lat}, ${lng}], 16);
          
          L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
          }).addTo(map);

          // Ikon biru untuk penanda (marker) pengguna
          var markerIcon = L.divIcon({
            className: 'custom-div-icon',
            html: "<div style='background-color:#4285F4; width:15px; height:15px; border-radius:50%; border:3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);'></div>",
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          });
          
          var marker = L.marker([${lat}, ${lng}], {icon: markerIcon}).addTo(map);

          // Garis Rute (Polyline)
          var coords = ${polylineCoords};
          var polyline = null;
          
          if (coords.length > 0) {
            polyline = L.polyline(coords, {color: '#FC4C02', weight: 5}).addTo(map);
            if (coords.length > 1) {
              map.fitBounds(polyline.getBounds(), { padding: [20, 20], maxZoom: 16 });
            }
          }

          // Fungsi untuk memperbarui lokasi dari React Native ke WebView
          window.updateLocation = function(newLat, newLng, newCoordsStr) {
            var newCoords = JSON.parse(newCoordsStr);
            marker.setLatLng([newLat, newLng]);
            map.panTo([newLat, newLng]);
            
            if (newCoords.length > 0) {
              if (polyline) {
                polyline.setLatLngs(newCoords);
              } else {
                polyline = L.polyline(newCoords, {color: '#FC4C02', weight: 5}).addTo(map);
              }
            }
          }
        </script>
      </body>
    </html>
  `;

  // Ketika props routeCoordinates atau currentLocation berubah, injeksi JavaScript untuk mengupdate peta
  useEffect(() => {
    if (webViewRef.current && currentLocation) {
      const runJs = `window.updateLocation(${currentLocation.latitude}, ${currentLocation.longitude}, '${polylineCoords}'); true;`;
      webViewRef.current.injectJavaScript(runJs);
    }
  }, [currentLocation, routeCoordinates]);

  return (
    <WebView
      ref={webViewRef}
      style={[styles.container, height ? { height } : {}]}
      originWhitelist={['*']}
      source={{ html: htmlContent }}
      scrollEnabled={false}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      // Dibutuhkan untuk performa di Android
      javaScriptEnabled={true}
      domStorageEnabled={true}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: '#e0e0e0',
  },
});
