# Pomodoro Pribadi
## Tujuan

Pengguna bisa membuka aplikasi di HP Android, memulai sesi fokus dengan satu ketukan, lalu melihat sisa waktu dengan benar setelah mengunci layar. Versi pertama menggunakan satu layar, berbahasa Indonesia, dengan data sesi tersimpan di perangkat.

## Alur satu siklus

| Tahap | Durasi bawaan | Setelah selesai |
| --- | --- | --- |
| Fokus ke-1, ke-2, atau ke-3 | 25 menit | Siapkan istirahat pendek selama 5 menit |
| Istirahat pendek | 5 menit | Siapkan fokus berikutnya |
| Fokus ke-4 | 25 menit | Siapkan istirahat panjang selama 15 menit |
| Istirahat panjang | 15 menit | Mulai siklus baru dari fokus ke-1 |

Pengguna menekan **Mulai** untuk setiap tahap. Saat tahap selesai, tampilkan pesan singkat, misalnya “Fokus selesai”, beserta durasi penuh tahap berikutnya. Jika HP ditinggal satu jam, hanya tahap yang sedang berjalan yang bisa selesai.

## Perilaku layar utama

| Kondisi | Tampilan dan aksi |
| --- | --- |
| Pertama dibuka | Tampilkan Fokus, 25:00, “0 dari 4 sesi fokus selesai”, dan tombol Mulai. |
| Berjalan | Tampilkan hitung mundur dalam MM:SS dan tombol Jeda. |
| Dijeda | Bekukan waktu, tampilkan status Dijeda serta pilihan Lanjutkan dan Ulangi sesi. |
| Sesi diulang | Kembalikan durasi penuh tahap saat ini ke kondisi Siap. Pertahankan jumlah fokus yang sudah selesai. |
| Tahap selesai | Tambah progres hanya jika tahap tadi adalah fokus. Tampilkan tahap berikutnya dalam kondisi Siap dengan tombol Mulai. |

Selama istirahat panjang, tampilkan “4 dari 4 sesi fokus selesai”. Kembalikan progres ke nol setelah istirahat panjang selesai. Alarm saat layar terkunci dan riwayat harian dapat ditambahkan pada versi berikutnya. Versi pertama memberi tanda selesai di layar aplikasi.

## Implementasi React Native

- Gunakan TypeScript dan Expo. Pisahkan logika pergantian tahap dari komponen layar agar siklus bisa diuji dengan waktu simulasi. Panduan visual ada di [style.md](style.md).
- Simpan satu rekaman status di AsyncStorage setiap kali pengguna memulai, menjeda, melanjutkan, atau mengulangi sesi, dan saat tahap selesai. Rekaman memuat tahap, kondisi, jumlah fokus selesai, waktu selesai absolut saat berjalan, dan sisa milidetik saat dijeda.
- Tunggu pemulihan rekaman sebelum mengaktifkan tombol. Saat berjalan, hitung sisa detik dengan `Math.max(0, Math.ceil((endAt - Date.now()) / 1000))`. Interval hanya menyegarkan angka di layar.
- Saat aplikasi dibuka kembali atau AppState kembali aktif, cocokkan status dengan waktu sekarang. Jika tenggat sudah lewat, selesaikan tahap satu kali dan simpan tahap berikutnya sebagai Siap dalam satu rekaman. Jika sedang dijeda, pulihkan sisa waktu tersimpan.

## Preview di Fedora 45 dan HP Android

Pasang Expo Go melalui Play Store. Di terminal Fedora, siapkan Node.js dan buat proyek berikut.

```bash
sudo dnf install nodejs
node --version
npm --version
npx create-expo-app@latest pomodoro-pribadi
cd pomodoro-pribadi
npx expo install @react-native-async-storage/async-storage
npx expo start
```

Hubungkan laptop dan HP ke Wi-Fi yang sama, buka Expo Go, lalu pindai QR di terminal. Pastikan layar bawaan proyek terbuka sebelum menggantinya dengan layar timer. Jika jaringan memblokir koneksi antarperangkat, hentikan server dengan Ctrl+C, jalankan `npx expo start --tunnel`, lalu pindai QR baru.

Referensi resmi pengembangan tersedia di [Fedora Developer Portal](https://developer.fedoraproject.org/tech/languages/nodejs/nodejs.html) dan [panduan preview Expo](https://docs.expo.dev/get-started/start-developing/).

## Kriteria penerimaan

| Uji | Hasil yang diharapkan |
| --- | --- |
| Ketuk Mulai dari layar awal | Dalam satu detik angka berubah menjadi 24:59 dan tombol menjadi Jeda. |
| Jeda selama 10 detik, lalu lanjutkan | Angka tetap saat dijeda. Hitung mundur berlanjut dari sisa yang sama. |
| Ulangi fokus ke-2 saat dijeda | Timer kembali ke 25:00 dan progres tetap 1 dari 4. |
| Kunci HP sekitar 1 menit saat berjalan | Saat kembali, sisa waktu mencerminkan durasi yang telah berlalu. |
| Tutup lalu buka aplikasi setelah tenggat | Tahap berikutnya siap dimulai. Buka ulang sekali lagi dan pastikan progres tetap sama. |
| Selesaikan empat fokus beserta jedanya | Setelah fokus ke-4 muncul istirahat 15:00. Setelah istirahat itu selesai, muncul Fokus 25:00 dengan progres nol. |

Untuk mencoba pergantian tahap dengan cepat, gunakan durasi uji 10 detik di lingkungan pengembangan. Kembalikan durasi bawaan sebelum penggunaan pribadi.
