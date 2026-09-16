# Limpia Fotos

App para móvil (iOS y Android) que te enseña las fotos del carrete una a una, estilo Tinder:

- **Desliza a la izquierda** (o pulsa ✕): la foto va a la papelera.
- **Desliza a la derecha** (o pulsa ♥): la foto se guarda y no vuelve a salir.
- **Deshacer** (↩): recupera la última decisión, tanto si fue borrar como guardar. Se pueden deshacer varias seguidas.
- **Papelera** (icono arriba a la derecha): ves todo lo marcado para borrar, tocas una foto para recuperarla, y con *Borrar N fotos* se eliminan del teléfono.

## Por qué hay papelera en vez de borrar al instante

iOS y Android obligan a que el sistema pida confirmación cada vez que una app borra fotos. Si cada swipe a la izquierda lanzara ese diálogo, revisar 500 fotos serían 500 confirmaciones. Con la papelera, revisas a toda velocidad y confirmas una sola vez por lote. Además así puedes corregir un despiste antes de que sea definitivo.

En iPhone, las fotos borradas quedan 30 días más en *Eliminadas recientemente* de la app Fotos.

## Progreso

Lo guardado, lo pendiente de borrar y el contador de borradas se guardan en el teléfono, así que puedes cerrar la app y seguir otro día. En *Ajustes* puedes:

- cambiar el orden (más recientes o más antiguas primero),
- ver las estadísticas,
- reiniciar el progreso para volver a revisar las guardadas,
- añadir más fotos si diste acceso limitado.

Solo se revisan imágenes (no vídeos). Nada sale del teléfono: no hay servidor ni cuentas.

## Probarla en tu móvil

Requisitos: Node 20 o superior y la app **Expo Go** instalada en el móvil (App Store / Google Play).

```bash
cd photo-swipe
npm install
npx expo start
```

Escanea el QR con la cámara (iPhone) o con Expo Go (Android). El móvil y el ordenador tienen que estar en la misma red Wi‑Fi. La primera vez pedirá acceso a las fotos.

## Instalarla como app de verdad

Para tener el icono en el móvil sin depender de Expo Go, se genera un binario con EAS Build (cuenta gratuita en expo.dev):

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform android --profile preview   # genera un .apk instalable
eas build --platform ios --profile preview       # necesita cuenta de desarrollador de Apple
```

Los identificadores de la app están en `app.json` (`ios.bundleIdentifier` y `android.package`); cámbialos si quieres publicarla con otro nombre.

## Estructura

```
App.tsx                         Punto de entrada
src/screens/ReviewScreen.tsx    Pantalla principal (pila de tarjetas, cabecera, botones)
src/components/SwipeCard.tsx    Tarjeta con el gesto de swipe y las animaciones
src/components/ActionBar.tsx    Botones ✕ / ↩ / ♥
src/components/TrashSheet.tsx   Papelera con recuperación y borrado en lote
src/components/SettingsSheet.tsx
src/components/PermissionGate.tsx
src/hooks/useReviewSession.ts   Cola de fotos, deshacer, papelera y persistencia
src/lib/photoLibrary.ts         Acceso al carrete (expo-media-library) y borrado
src/lib/reviewStorage.ts        Guardado del progreso (AsyncStorage)
```

Tecnologías: Expo SDK 57, React Native, `expo-media-library`, `expo-image`, `react-native-gesture-handler`, `react-native-reanimated`.
