<#
  prepare_branding.ps1
  ---------------------------------------------------------------------------
  Turns the kapIT branding PNGs in docs/ into clean, transparent-background
  assets used by the web dashboard and the Flutter app.

  Source (docs/):
    - "KapIT Disaster Response Branding Mobile.png"   -> square mark (app icon)
    - "KapIT Disaster Response Branding Web Logo.png" -> full wordmark

  Output:
    - web/public/kapit-mark.png           + web/public/kapit-logo.png
    - mobile/assets/images/kapit_mark.png + mobile/assets/images/kapit_logo.png

  The background is removed with a flood fill from the image border, so only
  the *exterior* white is made transparent — white areas inside the mark
  (e.g. the map silhouette) are preserved.

  Usage:  powershell -ExecutionPolicy Bypass -File scripts/prepare_branding.ps1
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$docs = Join-Path $root 'docs'
$webDir = Join-Path $root 'web/public'
$mobileDir = Join-Path $root 'mobile/assets/images'

$markSrc = Join-Path $docs 'KapIT Disaster Response Branding Mobile.png'
$logoSrc = Join-Path $docs 'KapIT Disaster Response Branding Web Logo.png'

foreach ($src in @($markSrc, $logoSrc)) {
    if (-not (Test-Path -LiteralPath $src)) { throw "Missing source image: $src" }
}
New-Item -ItemType Directory -Force -Path $webDir | Out-Null
New-Item -ItemType Directory -Force -Path $mobileDir | Out-Null

Add-Type -AssemblyName System.Drawing

$csharp = @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public static class BrandingTools
{
    // Flood-fills the exterior near-white background from the image border,
    // writes a transparent PNG, then auto-crops to the visible artwork with a
    // small padding. tolerance is the minimum channel value treated as "white"
    // (higher = only very-white pixels are removed, keeping faint shadows).
    public static void MakeTransparent(string input, string output, int tolerance, int pad)
    {
        using (var src = new Bitmap(input))
        using (var bmp = new Bitmap(src.Width, src.Height, PixelFormat.Format32bppArgb))
        {
            using (var g = Graphics.FromImage(bmp))
            {
                g.DrawImage(src, 0, 0, src.Width, src.Height);
            }

            int w = bmp.Width, h = bmp.Height;
            var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
            int stride = data.Stride;
            int bytes = Math.Abs(stride) * h;
            byte[] buf = new byte[bytes];
            Marshal.Copy(data.Scan0, buf, 0, bytes);

            Func<int, int, bool> isWhite = (x, y) =>
            {
                int i = y * stride + x * 4;
                return buf[i] >= tolerance && buf[i + 1] >= tolerance && buf[i + 2] >= tolerance;
            };

            bool[] visited = new bool[w * h];
            var stack = new Stack<int>();

            for (int x = 0; x < w; x++)
            {
                foreach (int y in new[] { 0, h - 1 })
                {
                    int p = y * w + x;
                    if (!visited[p] && isWhite(x, y)) { visited[p] = true; stack.Push(p); }
                }
            }
            for (int y = 0; y < h; y++)
            {
                foreach (int x in new[] { 0, w - 1 })
                {
                    int p = y * w + x;
                    if (!visited[p] && isWhite(x, y)) { visited[p] = true; stack.Push(p); }
                }
            }

            while (stack.Count > 0)
            {
                int p = stack.Pop();
                int x = p % w, y = p / w;
                int i = y * stride + x * 4;
                buf[i] = 0; buf[i + 1] = 0; buf[i + 2] = 0; buf[i + 3] = 0;

                if (x > 0 && !visited[p - 1] && isWhite(x - 1, y)) { visited[p - 1] = true; stack.Push(p - 1); }
                if (x < w - 1 && !visited[p + 1] && isWhite(x + 1, y)) { visited[p + 1] = true; stack.Push(p + 1); }
                if (y > 0 && !visited[p - w] && isWhite(x, y - 1)) { visited[p - w] = true; stack.Push(p - w); }
                if (y < h - 1 && !visited[p + w] && isWhite(x, y + 1)) { visited[p + w] = true; stack.Push(p + w); }
            }

            Marshal.Copy(buf, 0, data.Scan0, bytes);
            bmp.UnlockBits(data);

            // Auto-crop to the visible artwork (alpha > 0) plus padding.
            int minX = w, minY = h, maxX = -1, maxY = -1;
            for (int y = 0; y < h; y++)
            {
                for (int x = 0; x < w; x++)
                {
                    int i = y * stride + x * 4;
                    if (buf[i + 3] > 0)
                    {
                        if (x < minX) minX = x;
                        if (x > maxX) maxX = x;
                        if (y < minY) minY = y;
                        if (y > maxY) maxY = y;
                    }
                }
            }

            if (maxX < 0 || maxY < 0)
            {
                bmp.Save(output, ImageFormat.Png);
                return;
            }

            minX = Math.Max(0, minX - pad);
            minY = Math.Max(0, minY - pad);
            maxX = Math.Min(w - 1, maxX + pad);
            maxY = Math.Min(h - 1, maxY + pad);

            var cropRect = new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
            using (var cropped = bmp.Clone(cropRect, PixelFormat.Format32bppArgb))
            {
                cropped.Save(output, ImageFormat.Png);
            }
        }
    }
}
'@

if (-not ('BrandingTools' -as [type])) {
    Add-Type -TypeDefinition $csharp -ReferencedAssemblies 'System.Drawing'
}

$targets = @(
    @{ src = $markSrc; out = (Join-Path $webDir 'kapit-mark.png'); tol = 200; pad = 10 },
    @{ src = $logoSrc; out = (Join-Path $webDir 'kapit-logo.png'); tol = 245; pad = 6 },
    @{ src = $markSrc; out = (Join-Path $mobileDir 'kapit_mark.png'); tol = 200; pad = 10 },
    @{ src = $logoSrc; out = (Join-Path $mobileDir 'kapit_logo.png'); tol = 245; pad = 6 }
)

foreach ($t in $targets) {
    [BrandingTools]::MakeTransparent($t.src, $t.out, $t.tol, $t.pad)
    Write-Host ("wrote {0}" -f $t.out)
}

# Opaque square icon for launcher icons (the transparent mark is used as the
# adaptive foreground; this keeps a solid white backdrop for legacy icons).
$iconOut = Join-Path $mobileDir 'kapit_icon.png'
Copy-Item -LiteralPath $markSrc -Destination $iconOut -Force
Write-Host ("wrote {0}" -f $iconOut)
