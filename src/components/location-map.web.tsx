import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

type Props = {
  title: string;
  latitude: number | null;
  longitude: number | null;
};

function buildIframeUrl(latitude: number, longitude: number) {
  const lat = latitude.toFixed(6);
  const lon = longitude.toFixed(6);
  return `https://www.openstreetmap.org/export/embed.html?bbox=${lon},${lat},${lon},${lat}&layer=mapnik&marker=${lat},${lon}`;
}

export function LocationMap({ title, latitude, longitude }: Props) {
  const hasCoords = latitude !== null && longitude !== null;

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
      <View style={styles.iframeCard}>
        {/**
         * React Native Web allows native DOM elements.
         */}
        <iframe
          title="Mapa"
          src={buildIframeUrl(latitude, longitude)}
          style={{ border: 0, width: '100%', height: '240px' }}
          loading="lazy"
        />
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
  iframeCard: {
    overflow: 'hidden',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#F0C7A3',
    backgroundColor: '#FFF8F2',
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
