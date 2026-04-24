import { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

type Props = {
  title: string;
  latitude: number | null;
  longitude: number | null;
};

export function LocationMap({ title, latitude, longitude }: Props) {
  const hasCoords = latitude !== null && longitude !== null;
  const [loadError, setLoadError] = useState(false);

  const html = useMemo(() => {
    const lat = latitude ?? 0;
    const lon = longitude ?? 0;
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
    <link
      rel="stylesheet"
      href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
      crossorigin=""
    />
    <style>
      html, body, #map { height: 100%; margin: 0; background: #efe7de; }
      .leaflet-container { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script
      src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
      integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
      crossorigin=""
    ></script>
    <script>
      const map = L.map('map', { zoomControl: false }).setView([${lat}, ${lon}], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: ''
      }).addTo(map);
      L.marker([${lat}, ${lon}]).addTo(map);
    </script>
  </body>
</html>`;
  }, [latitude, longitude]);

  if (!hasCoords) {
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>{title}</Text>
        <Text style={styles.emptyText}>Localizacao indisponivel no momento.</Text>
      </View>
    );
  }

  const openExternalMap = () => {
    void Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`);
  };

  return (
    <View style={styles.container}>
      <View style={styles.mapCard}>
        {loadError ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{title}</Text>
            <Text style={styles.emptyText}>Nao foi possivel carregar o mapa no app.</Text>
          </View>
        ) : (
          <WebView
            originWhitelist={['*']}
            source={{ html }}
            style={styles.map}
            onError={() => setLoadError(true)}
            javaScriptEnabled
            domStorageEnabled
            scrollEnabled={false}
          />
        )}
      </View>
      <Text style={styles.coordsText}>Latitude: {latitude}</Text>
      <Text style={styles.coordsText}>Longitude: {longitude}</Text>
      <Pressable style={styles.linkButton} onPress={openExternalMap}>
        <Text style={styles.linkButtonText}>Abrir no Google Maps</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  mapCard: {
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0C7A3',
    backgroundColor: '#FFF8F2',
  },
  map: {
    width: '100%',
    height: 240,
    backgroundColor: '#EFE7DE',
  },
  emptyState: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0C7A3',
    backgroundColor: '#FFF8F2',
    padding: 16,
    gap: 8,
  },
  emptyTitle: {
    color: '#6B3D17',
    fontSize: 16,
    fontWeight: '700',
  },
  emptyText: {
    color: '#8B5E36',
    lineHeight: 20,
  },
  coordsText: {
    color: '#5E4530',
    fontWeight: '600',
  },
  linkButton: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    backgroundColor: '#F97316',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  linkButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
});
