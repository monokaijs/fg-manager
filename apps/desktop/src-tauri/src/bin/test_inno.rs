use std::fs::File;

fn main() {
    let file = File::open("E:\\Games\\damon-and-baby\\setup.exe").expect("File not found");
    match inno::Inno::new(file) {
        Ok(inno) => {
            println!("Inno Setup Version: {:?}", inno.version());
            println!("==== Icons (Shortcuts) ====");
            for icon in inno.icons() {
                println!("- Target: {:?}", icon);
            }
        }
        Err(e) => {
            eprintln!("Failed to parse: {:?}", e);
        }
    }
}
