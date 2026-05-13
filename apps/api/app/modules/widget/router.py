"""
Widget router — /api/v1/widget
Виджет записи для встраивания на внешние сайты.
Отдаёт JS-скрипт + embed-эндпоинты.
"""

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.config import settings
from app.modules.masters.service import MasterService

router = APIRouter()


WIDGET_JS_TEMPLATE = """
(function() {
  var slug = "%SLUG%";
  var appUrl = "%APP_URL%";
  var container = document.getElementById("bookmaster-widget");
  if (!container) {
    container = document.createElement("div");
    container.id = "bookmaster-widget";
    document.currentScript.parentElement.appendChild(container);
  }
  var iframe = document.createElement("iframe");
  iframe.src = appUrl + "/embed/" + slug;
  iframe.style.width = "100%%";
  iframe.style.minHeight = "600px";
  iframe.style.border = "none";
  iframe.style.borderRadius = "12px";
  iframe.style.boxShadow = "0 2px 12px rgba(0,0,0,0.08)";
  iframe.allow = "payment";
  container.appendChild(iframe);

  window.addEventListener("message", function(e) {
    if (e.data && e.data.type === "bookmaster-resize") {
      iframe.style.height = e.data.height + "px";
    }
  });
})();
"""


@router.get("/js/{slug}")
async def get_widget_js(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """JS-виджет для встраивания на сайт мастера."""
    service = MasterService(db)
    master = await service.get_by_slug(slug)
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")

    js = WIDGET_JS_TEMPLATE.replace("%SLUG%", slug).replace("%APP_URL%", settings.APP_URL)
    return Response(
        content=js,
        media_type="application/javascript",
        headers={
            "Cache-Control": "public, max-age=3600",
            "Access-Control-Allow-Origin": "*",
        },
    )


EMBED_HTML_TEMPLATE = """<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Запись к {name}</title>
<style>
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ font-family: -apple-system, BlinkMacSystemFont, sans-serif; background: #fff; }}
  .header {{ padding: 20px; text-align: center; border-bottom: 1px solid #eee; }}
  .header h1 {{ font-size: 20px; color: #333; }}
  .header p {{ color: #888; font-size: 14px; margin-top: 4px; }}
  .booking-link {{ display: block; text-align: center; padding: 40px 20px; }}
  .booking-link a {{
    display: inline-block; padding: 14px 32px;
    background: #7c3aed; color: #fff; border-radius: 10px;
    text-decoration: none; font-size: 16px; font-weight: 600;
  }}
  .booking-link a:hover {{ background: #6d28d9; }}
</style>
</head>
<body>
  <div class="header">
    <h1>{name}</h1>
    <p>{specialization}</p>
  </div>
  <div class="booking-link">
    <a href="{app_url}?startParam=m_{slug}" target="_blank">Записаться</a>
  </div>
</body>
</html>"""


@router.get("/embed/{slug}", response_class=HTMLResponse)
async def get_embed_page(
    slug: str,
    db: AsyncSession = Depends(get_db),
):
    """Embed-страница записи к мастеру (для iframe)."""
    service = MasterService(db)
    master = await service.get_by_slug(slug)
    if not master:
        raise HTTPException(status_code=404, detail="Master not found")

    html = EMBED_HTML_TEMPLATE.format(
        name=master.display_name or master.name or slug,
        specialization=master.specialization or "",
        app_url=settings.APP_URL,
        slug=slug,
    )
    return HTMLResponse(
        content=html,
        headers={
            "X-Frame-Options": "ALLOWALL",
            "Content-Security-Policy": "frame-ancestors *",
        },
    )
