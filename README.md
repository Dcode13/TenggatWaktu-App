# TenggatWaktu

Aplikasi fokus berbahasa Indonesia untuk Android, dibuat dengan Expo SDK 58, React Native, TypeScript, dan Expo Router. Versi 2 memperluas [PRD awal](docs/prd.md) dengan penyimpanan lokal, tugas, statistik, pengaturan, dan cadangan. Tampilan tetap mengikuti [panduan visual](docs/style.md): arang, angka besar, dan aksen hijau.

Nama aplikasi kini **TenggatWaktu**. Identitas proyek, kunci penyimpanan, dan format cadangan lama dipertahankan supaya data serta cadangan Pomodoro Pribadi tetap dapat digunakan. Dokumen PRD dan panduan visual disimpan sebagai referensi awal.

## Fitur

- **Timer:** fokus 25 menit, istirahat pendek 5 menit, dan istirahat panjang 15 menit setelah fokus keempat. Mulai, jeda, lanjutkan, ulangi sesi, serta lewati istirahat.
- **Pengaturan:** durasi fokus 1–120 menit, istirahat pendek 1–60 menit, istirahat panjang 1–120 menit, serta target harian 1–24 sesi. Durasi baru tidak memotong sesi berjalan atau dijeda; berlaku pada sesi berikutnya atau saat diulang.
- **Tugas:** tambah, edit, pilih tugas untuk fokus, tandai selesai, aktifkan kembali, dan hapus. Target 1–24 sesi per tugas; maksimal 1.000 tugas. Judul tugas pada riwayat mempertahankan nama saat sesi dimulai.
- **Riwayat:** catatan sesi selesai, diulang, dan istirahat yang dilewati; pencarian nama tugas dan filter hari ini/fokus selesai.
- **Statistik:** jumlah fokus hari ini, target harian, total durasi, grafik tujuh hari, dan hari beruntun. Hanya fokus yang selesai dihitung; tanggal mengikuti zona waktu perangkat.
- **Pengingat:** notifikasi lokal opsional pada Android/iOS, pengaturan suara, dan getar. Izin diminta saat pengguna mengaktifkannya. Browser menampilkan status selesai di layar.
- **Cadangan:** ekspor/impor JSON untuk tugas, riwayat, dan pengaturan. Hapus riwayat atau seluruh data melalui konfirmasi; hapus seluruh data memerlukan ketikan `HAPUS`.

Setiap tahap tetap dimulai manual. Meninggalkan HP selama satu jam hanya menyelesaikan tahap yang sedang berjalan, tanpa otomatis memulai tahap berikutnya.

## Menjalankan aplikasi

Gunakan Node.js 22 LTS atau lebih baru.

```bash
npm ci
npm start
```

Untuk preview Android, hubungkan HP dan komputer ke Wi-Fi yang sama lalu pindai QR dengan Expo Go yang mendukung SDK 58. Preview browser: `npm run web`. Data browser dan HP terpisah. Setelah perubahan modul native, gunakan build aplikasi baru untuk memeriksa integrasi native secara utuh.

## Membuat APK Android

Profil `apk` di [eas.json](eas.json) menghasilkan APK rilis bertanda tangan yang dapat dipasang langsung dan dipakai tanpa Expo Go atau server Metro. Nama aplikasi yang terpasang adalah **TenggatWaktu**. Nomor build Android bertambah otomatis melalui EAS; versi yang terlihat tetap mengikuti `app.json`.

Login ke akun Expo pada komputer ini, lalu mulai build:

```bash
npx eas-cli@latest login
npm run build:apk
```

Pada build pertama, CLI akan menghubungkan/membuat proyek Expo dan menyiapkan keystore Android. Gunakan keystore yang sama untuk pembaruan aplikasi berikutnya. Build berjalan di cloud dan mengikuti kuota akun Expo.

Setelah status **Finished**, buka tautan hasil build dari terminal, unduh file `.apk` di Android, lalu buka file tersebut untuk memasang. Jika Android meminta, izinkan pemasangan dari browser/file manager yang digunakan. Aplikasi dapat dibuka dari ikon **TenggatWaktu** tanpa laptop menyala.

Untuk melihat build terakhir:

```bash
npx eas-cli@latest build:list --platform android --build-profile apk --limit 1
```

Data di Expo Go terpisah dari APK mandiri. Untuk memindahkannya, ekspor cadangan JSON dari Expo Go, lalu impor melalui Pengaturan di TenggatWaktu setelah terpasang. Profil `production` menghasilkan AAB untuk distribusi melalui toko aplikasi; gunakan `build:apk` untuk file yang dapat dipasang langsung.

Panduan resmi: [build APK](https://docs.expo.dev/build-reference/apk/) dan [persiapan build pertama](https://docs.expo.dev/build/setup/).

## Penyimpanan dan pemulihan

Data disimpan otomatis pada setiap perubahan, tanpa server, akun, atau sinkronisasi antarperangkat. Android/iOS menggunakan `expo-sqlite/kv-store`; preview web menggunakan AsyncStorage berbasis penyimpanan browser. Data ini tidak dienkripsi oleh aplikasi. Menghapus aplikasi atau membersihkan data browser dapat menghapus data lokal; simpan file cadangan di luar aplikasi.

Timer menyimpan tenggat absolut dan sisa milidetik saat dijeda. Interval hanya memperbarui tampilan; saat kembali dari latar belakang atau membuka ulang aplikasi, waktu disesuaikan dengan tenggat. Penyelesaian sesi dan penambahan riwayat ditulis bersama dalam satu snapshot. Penulisan berurutan mencegah snapshot lama menimpa data baru. Jam sistem yang diubah manual juga mengubah perhitungan tenggat.

Sesi versi pertama di AsyncStorage dipindahkan otomatis. Rekaman lama baru dihapus setelah data baru berhasil tersimpan. Jika data versi baru rusak, aplikasi mempertahankannya dan menampilkan pemulihan melalui **Coba lagi**, impor cadangan valid, atau hapus semua data dengan konfirmasi. Jika penulisan gagal, perubahan terakhir tetap tersedia dalam memori untuk dicoba lagi; jangan menutup aplikasi sebelum berhasil.

## Menggunakan cadangan

1. Buka **Pengaturan → Ekspor cadangan JSON**. Di HP, pilih lokasi melalui menu berbagi/penyimpanan sistem; di browser, file diunduh.
2. Untuk memulihkan, pilih **Impor cadangan JSON**, pilih file, lalu tinjau jumlah data baru.
3. Pilih apakah pengaturan ikut dipulihkan, lalu tekan **Gabungkan cadangan**.

Impor menggabungkan berdasarkan ID. Mengimpor file yang sama berulang kali tidak menggandakan data; versi lokal dipertahankan ketika ID sudah ada. Timer aktif dan tugas yang terikat padanya tetap berjalan, serta izin notifikasi tetap mengikuti perangkat tujuan. Cadangan tidak menyalin timer aktif atau posisi siklus. Hapus seluruh data dahulu jika ingin memulihkan cadangan ke keadaan kosong.

File harus berupa format `pomodoro-pribadi`, versi cadangan `1`, maksimal **5 MB**. File rusak, versi tidak dikenal, angka tidak valid, dan ID duplikat ditolak sebelum perubahan. Ekspor juga memeriksa batas tersebut agar file yang dihasilkan dapat diimpor kembali. File JSON berisi nama tugas dan riwayat dalam teks biasa; simpan sesuai kebutuhan privasimu.

## Mode uji cepat

```bash
npm run start:quick
```

Semua tahap menjadi 10 detik hanya dalam pengembangan. Mode ini memakai penyimpanan terpisah. Hentikan server dan jalankan `npm start` untuk kembali ke durasi pengaturan. Build produksi selalu memakai pengaturan pengguna, bukan mode 10 detik.

## Pemeriksaan

```bash
npm run lint
npm run typecheck
npm test
npx expo-doctor
npm run build
npm run test:e2e
```

`npm run build` mengekspor bundle Android, iOS, dan web ke `dist/`; ini bukan kompilasi APK/IPA. Tes browser memakai ekspor web di port 4173. Google Chrome dicari di `/usr/bin/google-chrome`; gunakan `CHROME_BIN` untuk lokasi lain atau `npx playwright install chromium`.

Tes mencakup siklus lengkap, tenggat setelah aplikasi ditutup, jeda, migrasi, kegagalan penyimpanan, riwayat atomik, statistik tanggal lokal, tugas, perubahan durasi, ekspor/impor berulang, pemulihan data rusak, konfirmasi penghapusan, dan layar sempit.

Pengujian browser dan ekspor bundle tidak menggantikan pengujian di HP. Notifikasi, suara/getar, SQLite native, menu berbagi/pemilih file, keyboard, dan TalkBack perlu diuji pada perangkat fisik. Pengiriman notifikasi dapat terlambat karena izin alarm/pengaturan baterai Android; timer tetap memakai tenggat saat aplikasi dibuka. Tidak ada push server atau layanan berjalan terus-menerus di latar belakang. API lokal mengikuti [dokumentasi notifikasi SDK 58](https://docs.expo.dev/versions/v58.0.0/sdk/notifications/).

## Struktur

- `src/app/`: empat rute Expo Router dan navigasi tab.
- `src/screens/`: layar Timer, Tugas, Riwayat, dan Pengaturan.
- `src/components/ui.tsx`: komponen form, tombol, dialog, dan status penyimpanan.
- `src/data/model.ts`: data aplikasi, tugas, migrasi, validasi, serta penggabungan cadangan.
- `src/data/AppProvider.tsx`: hidrasi, antrean simpan, aksi, dan pemulihan saat AppState berubah.
- `src/data/deviceStorage.*`: penyimpanan sesuai platform.
- `src/data/statistics.ts`: agregasi sesi dan kalender lokal.
- `src/timer/model.ts`: state machine timer murni.
- `src/services/`: berkas cadangan dan pengingat lokal.
- `src/theme.ts`: palet visual.
- `assets/icon.svg`: sumber ikon; `npm run icons` menghasilkan PNG untuk Expo.
