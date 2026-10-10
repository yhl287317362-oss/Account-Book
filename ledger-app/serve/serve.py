# -*- coding: utf-8 -*-
"""
局域网调试服务 —— 让手机能用 http:// 访问这份单文件记账本。

为什么需要它：
  手机浏览器的 file:// 协议被 vivo / 微信等拦得很死，
  但 http:// 是正常网页上下文，Web Worker、IndexedDB 全部可用，识图能跑。
  这个脚本只把当前目录挂成一个只读网页服务，不做别的。

跑法：
  python serve.py              自动认网卡
  python serve.py 10.0.0.5     手动指定 IP
  python serve.py 10.0.0.5 9000  同时指定端口
"""
import http.server
import os
import re
import socket
import socketserver
import subprocess
import sys

DIR = os.path.dirname(os.path.abspath(__file__))
DEFAULT_PORT = 8080


def list_candidates():
    """列出所有可能有用的本机 IPv4，附带网卡名与网关。

    为什么要这么麻烦：这台机器上有 VirtualNet 之类的虚拟网卡（VPN / WSL / Docker），
    它们也有 IP、也有网关，而且路由优先级可能比真实网卡还高。
    直接取"第一个 IP"会拿到 172.19.0.1 那种手机根本连不上的地址。
    """
    try:
        r = subprocess.run(['ipconfig'], capture_output=True)
        txt = r.stdout.decode('gbk', 'replace')
    except Exception:
        return []

    # 明显是虚拟网卡的关键词，命中就跳过
    SKIP = ('virtualnet', 'vmware', 'virtualbox', 'hyper-v', 'wsl',
            'loopback', 'tap-', 'tun', 'docker', 'npcap', 'radmin')

    out = []
    name, ip, gw = '', None, None

    def flush():
        if ip and not any(k in name.lower() for k in SKIP):
            out.append({'name': name, 'ip': ip, 'gw': gw})

    for line in txt.splitlines():
        stripped = line.strip()
        # 网卡标题行：没有前导空格，形如「无线局域网适配器 WLAN:」
        if line[:1] not in (' ', '\t') and stripped.endswith(':') and ':' not in stripped[:-1]:
            flush()
            name, ip, gw = stripped[:-1], None, None
            continue
        m = re.search(r'IPv4[^:]*:\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)', stripped)
        if m:
            ip = m.group(1)
            continue
        g = re.search(r'(?:默认网关|Default Gateway)[^:]*:\s*([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)', stripped)
        if g:
            gw = g.group(1)
    flush()
    return out


def detect_ip():
    """挑一个手机最可能连得上的 IP：优先有网关的私网地址。"""
    cands = list_candidates()
    if not cands:
        return '127.0.0.1'
    # 先看有默认网关的（说明这块网卡真在联网）
    routed = [c for c in cands if c['gw']]
    pool = routed or cands
    # 私网前缀优先
    for c in pool:
        if c['ip'].startswith(('192.168.', '10.')):
            return c['ip']
    for c in pool:
        if c['ip'].startswith('172.') and not c['ip'].startswith(('172.17.', '172.18.', '172.19.')):
            return c['ip']
    return pool[0]['ip']



class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=DIR, **kw)

    def end_headers(self):
        # 调试期禁用缓存：改完文件手机刷新就能看到
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()

    def log_message(self, fmt, *args):
        print('  [%s] %s' % (self.log_date_time_string(), fmt % args), flush=True)


class Server(socketserver.ThreadingTCPServer):
    allow_reuse_address = True
    daemon_threads = True


def main():
    manual = len(sys.argv) > 1
    bind = sys.argv[1] if manual else detect_ip()
    port = int(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_PORT

    bar = '=' * 60
    print(bar)
    print('  记账本 · 局域网服务已启动')
    print('  目录：%s' % DIR)
    print()

    cands = list_candidates()
    if len(cands) > 1:
        print('  检测到的网卡：')
        for c in cands:
            mark = '  <== 用这个' if (c['ip'] == bind and not manual) else ''
            print('    %-10s %-16s 网关=%s%s'
                  % (c['name'][:10], c['ip'], c['gw'] or '无', mark))
        print()

    if bind == '127.0.0.1':
        print('  [!] 没找到可用的局域网网卡，服务只能本机访问。')
        print('      请检查网络，或手动指定：python serve.py <你的IP>')
    else:
        print('  ▼ 手机上打开这个地址：')
        print()
        print('        http://%s:%d/' % (bind, port))
        print()
        print('  ▼ 前提：手机和这台电脑连在同一个 WiFi 上')
        if not manual and len(cands) > 1:
            print('  ▼ 如果手机连不上，试试上面列出的其它 IP 地址')
    print('  ▼ 停止：在这个窗口按 Ctrl+C，或直接关掉窗口')
    print(bar)
    print()

    try:
        with Server((bind, port), Handler) as httpd:
            httpd.serve_forever()
    except OSError as e:
        print('[X] 端口 %d 启动失败：%s' % (port, e))
        print('    可能是被占用，换个端口重试：python serve.py %s 8081' % bind)
    except KeyboardInterrupt:
        print('\n服务已停止')


if __name__ == '__main__':
    main()
