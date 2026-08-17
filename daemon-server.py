#!/usr/bin/env python3
"""Fork-based daemon that starts server.py and keeps it alive."""
import os, sys, time, signal

# Double-fork to daemonize properly
if os.fork() > 0:
    sys.exit(0)  # Parent exits
os.setsid()
if os.fork() > 0:
    sys.exit(0)  # Second parent exits

# Redirect stdio
sys.stdin.close()
sys.stdout.close()
sys.stderr.close()
os.open(os.devnull, os.O_RDONLY)  # fd 0
os.open('/tmp/server.log', os.O_WRONLY | os.O_CREAT | os.O_APPEND, 0o644)  # fd 1
os.dup2(1, 2)  # fd 2 = fd 1

signal.signal(signal.SIGTERM, signal.SIG_IGN)
signal.signal(signal.SIGHUP, signal.SIG_IGN)

while True:
    pid = os.fork()
    if pid == 0:
        # Child: exec the server
        os.chdir('/home/z/my-project')
        os.execvp('python3', ['python3', '/home/z/my-project/server.py'])
        os._exit(1)
    else:
        # Parent: wait for child, then restart
        try:
            _, status = os.waitpid(pid, 0)
        except ChildProcessError:
            pass
        time.sleep(1)
