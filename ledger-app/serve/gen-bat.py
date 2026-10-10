# -*- coding: utf-8 -*-
"""
生成「手机访问」启动脚本（GBK 编码，避免 cmd 窗口里中文乱码）。
跑法：python gen-bat.py
"""
import os

HERE = os.path.dirname(os.path.abspath(__file__))
PY_ABS = r'C:\Users\28731\.workbuddy\binaries\python\versions\3.13.12\python.exe'

BAT = r"""@echo off
title 记账本 - 手机访问服务
cd /d "%SERVE_DIR%"

if not exist "serve.py" (
    echo.
    echo   [X] 找不到 serve.py，目录可能被移动了：
    echo       %SERVE_DIR%
    echo.
    pause
    exit /b 1
)

set "PY="
where python >nul 2>&1
if %errorlevel%==0 set "PY=python"
if not defined PY if exist "%PY_ABS%" set "PY=%PY_ABS%"
if not defined PY (
    echo.
    echo   [X] 没有找到 Python 运行环境，无法启动服务。
    echo.
    pause
    exit /b 1
)

echo.
echo  ============================================================
echo    记账本 - 手机访问服务
echo  ============================================================
echo.

rem ---------- 1) 放行防火墙（只第一次需要管理员） ----------
netsh advfirewall firewall show rule name="Ledger-LAN-8080" >nul 2>&1
if %errorlevel% neq 0 (
    net session >nul 2>&1
    if %errorlevel% neq 0 (
        echo   [!] 第一次运行需要先放行防火墙，这一步要管理员权限。
        echo.
        echo       请关掉这个窗口，右键本文件，选「以管理员身份运行」。
        echo.
        pause
        exit /b 1
    )
    netsh advfirewall firewall add rule name="Ledger-LAN-8080" dir=in action=allow protocol=TCP localport=8080 profile=any >nul 2>&1
    if %errorlevel%==0 (
        echo   [1/3] 防火墙已放行 8080 端口
    ) else (
        echo   [1/3] [!] 防火墙放行失败，手机可能连不上
    )
) else (
    echo   [1/3] 防火墙已放行，跳过
)

rem ---------- 2) 端口是否已被占用 ----------
netstat -ano | findstr ":8080" | findstr "LISTENING" >nul 2>&1
if %errorlevel%==0 (
    echo   [2/3] 服务已经在运行了
    echo.
    %PY% -c "import sys;sys.path.insert(0,'.');import serve;print('   >> 手机上打开:  http://%%s:8080/' %% serve.detect_ip())"
    echo.
    pause
    exit /b 0
)
echo   [2/3] 端口空闲

rem ---------- 3) 启动服务 ----------
echo   [3/3] 启动服务 ...
echo.
%PY% serve.py
echo.
pause
""".replace('%PY_ABS%', PY_ABS).replace('%SERVE_DIR%', HERE)

TARGETS = [
    os.path.join(HERE, '启动服务.bat'),
    r'C:\Users\28731\Desktop\记账本-手机访问.bat',
]

for p in TARGETS:
    d = os.path.dirname(p)
    if not os.path.isdir(d):
        print('跳过（目录不存在）:', p)
        continue
    with open(p, 'w', encoding='gbk', errors='replace') as f:
        f.write(BAT)
    print('已写出: %s  (%d 字节)' % (p, os.path.getsize(p)))
