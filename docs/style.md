# Panduan visual Pomodoro Pribadi

Gunakan latar hitam arang, angka besar, dan satu aksen hijau. Saat pengguna melirik HP di meja, urutan yang perlu terbaca adalah sisa waktu, jenis sesi, lalu aksi yang tersedia.

## Palet

| Token | Warna | Penggunaan |
| --- | --- | --- |
| background | `#101411` | Seluruh layar dan area bilah sistem |
| textPrimary | `#F0F5EF` | Angka timer dan judul tahap |
| textMuted | `#A8B5AA` | Status, progres, dan keterangan selesai |
| accent | `#85DE99` | Tombol utama dan indikator progres terisi |
| onAccent | `#102016` | Teks pada tombol hijau |
| accentPressed | `#6AC780` | Tombol hijau selama ditekan |
| outline | `#68776C` | Garis tepi tombol dan indikator kosong |

## Komposisi layar

1. **Atas** — Tempatkan identitas “Pomodoro” rata kiri di bawah safe area, dengan margin horizontal 24 dp.
2. **Tengah** — Susun nama tahap, timer, status, lalu progres dalam satu kolom rata tengah. Gunakan ruang kosong untuk memisahkan kelompok timer dari kontrol.
3. **Bawah** — Tempatkan tombol utama selebar area konten, dengan jarak 24 dp dari safe area bawah. Sediakan ruang bagi aksi sekunder saat dijeda agar kelompok timer tetap stabil.

Gunakan satu permukaan datar dengan radius tombol 14 dp. Pada layar pendek atau ukuran font besar, izinkan konten bergulir agar kontrol tetap terjangkau.

## Tipografi dan spasi

| Elemen | Spesifikasi |
| --- | --- |
| Timer | Roboto atau font sistem Android, 72 sp, medium, angka tabular melalui `fontVariant: ['tabular-nums']`. Gunakan 56 sp pada layar sempit jika perlu. |
| Nama tahap | 24 sp, medium, teks lengkap seperti “Istirahat panjang”. |
| Identitas aplikasi dan tombol | 16 sp, medium. |
| Status dan progres | 14 sp, regular. |
| Spasi | 8 dp antara elemen terkait, 16 dp antara timer dan status, 32 dp sebelum kelompok progres. |

## Tampilan per kondisi

| Kondisi | Status di bawah angka | Tombol utama | Aksi sekunder |
| --- | --- | --- | --- |
| Siap | Siap | Mulai · isi hijau | — |
| Berjalan | Sedang berjalan | Jeda · garis tepi | — |
| Dijeda | Dijeda | Lanjutkan · isi hijau | Ulangi sesi |
| Selesai, tahap berikutnya siap | “Fokus selesai” atau “Istirahat selesai” | Mulai · isi hijau | — |

Saat fokus selesai, misalnya, judul langsung berubah menjadi **Istirahat pendek**, angka menjadi **05:00**, dan status berbunyi **Fokus selesai**. Gunakan pola visual yang sama untuk fokus dan istirahat. Nama tahap menjelaskan perbedaannya.

## Komponen dan aksesibilitas

- Buat empat segmen progres dengan celah 4 dp. Segmen selesai berisi hijau, sisanya bergaris tepi. Sertakan teks “2 dari 4 sesi fokus selesai” sesuai hitungan aktual.
- Gunakan tinggi minimum tombol 52 dp dan area sentuh minimum 48 × 48 dp untuk “Ulangi sesi”. Saat tombol garis tepi ditekan, beri latar hijau gelap `#223328`.
- Aktifkan penskalaan font sistem. Uji pada lebar 360 dp dan ukuran teks besar. Pastikan angka, judul “Istirahat panjang”, dan tombol bisa dibaca utuh.
- Beri tombol peran aksesibilitas tombol. TalkBack dapat membaca timer sebagai “24 menit 8 detik” saat dipilih. Umumkan perubahan tahap satu kali agar hitung mundur tidak menyela pengguna setiap detik.
