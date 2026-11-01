using System;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;
using System.Threading;

internal static class LumaLauncher {
    static Process server;
    static NotifyIcon tray;
    static string appUrl;
    static bool quitting;
    static string root;
    static Mutex singleton;
    [STAThread] static void Main() {
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        singleton=new Mutex(false,"Local\\LumaRadioDesktopV1");
        if(!singleton.WaitOne(0,false)){MessageBox.Show("LUMA вже працює. Відкрий її через фіолетовий значок у системному треї.","LUMA");return;}
        root=AppDomain.CurrentDomain.BaseDirectory;
        string node=FindNode();
        if(node==null) {
            MessageBox.Show("Для запуску LUMA потрібен Node.js 22 або новіший. Встанови його з https://nodejs.org/ і запусти LUMA знову.","LUMA",MessageBoxButtons.OK,MessageBoxIcon.Information);
            return;
        }
        string app=Path.Combine(root,"luma.cjs");
        if(!File.Exists(app)) {MessageBox.Show("Розпакуй увесь архів перед запуском LUMA. Файл luma.cjs має бути поруч із LUMA.exe.","LUMA");return;}
        try {
            var start=new ProcessStartInfo(node,"\""+app+"\" --no-open");
            start.WorkingDirectory=root;start.UseShellExecute=false;start.CreateNoWindow=true;
            start.RedirectStandardOutput=true;start.RedirectStandardError=true;start.StandardOutputEncoding=Encoding.UTF8;
            server=Process.Start(start);
            server.BeginErrorReadLine();
            var ready=server.StandardOutput.ReadLineAsync();
            if(!ready.Wait(12000))throw new Exception("Сервер не відповів вчасно.");
            string line=ready.Result??"";
            var match=Regex.Match(line,@"http://127\.0\.0\.1:\d+");
            if(!match.Success)throw new Exception("Не вдалося запустити локальний сервер.");
            appUrl=match.Value;
            tray=new NotifyIcon();tray.Icon=File.Exists(Path.Combine(root,"LUMA.ico"))?new Icon(Path.Combine(root,"LUMA.ico")):SystemIcons.Application;tray.Text="LUMA";
            var menu=new ContextMenuStrip();
            menu.Items.Add("Відкрити LUMA",null,delegate{OpenApp();});
            menu.Items.Add(new ToolStripSeparator());
            menu.Items.Add("Зупинити та вийти",null,delegate{Quit();});
            tray.ContextMenuStrip=menu;tray.DoubleClick+=delegate{OpenApp();};tray.Visible=true;
            Application.ApplicationExit+=delegate{StopServer();if(tray!=null)tray.Dispose();};
            OpenApp();
            tray.ShowBalloonTip(3500,"LUMA","LUMA працює. Щоб завершити: правий клік на значку в треї → «Зупинити та вийти».",ToolTipIcon.Info);
            Application.Run();
        }catch(Exception e){StopServer();MessageBox.Show("Не вдалося запустити LUMA. "+e.Message,"LUMA",MessageBoxButtons.OK,MessageBoxIcon.Error);}
    }
    static string FindNode(){
        string[] candidates={Path.Combine(root,"runtime","node.exe"),Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles),"nodejs","node.exe")};
        foreach(var p in candidates)if(File.Exists(p))return p;
        foreach(var p in (Environment.GetEnvironmentVariable("PATH")??"").Split(Path.PathSeparator)){try{var f=Path.Combine(p,"node.exe");if(File.Exists(f))return f;}catch{}}
        return null;
    }
    static void OpenApp(){
        string edge=Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),"Microsoft","Edge","Application","msedge.exe");
        if(File.Exists(edge)){
            var p=new ProcessStartInfo(edge,"--app="+appUrl+" --user-data-dir=\""+Path.Combine(root,"data","browser")+"\" --no-first-run");
            p.UseShellExecute=false;p.CreateNoWindow=true;Process.Start(p);
        }else{Process.Start(new ProcessStartInfo(appUrl){UseShellExecute=true});}
    }
    static void Quit(){if(quitting)return;quitting=true;Application.Exit();}
    static void StopServer(){try{if(server!=null&&!server.HasExited)server.Kill();}catch{}if(server!=null)server.Dispose();}
}
