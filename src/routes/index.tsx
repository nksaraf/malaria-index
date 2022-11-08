export default function Report() {
  return (
    <>
      <div class="fixed top-24 left-4 w-[320px]">
        <div class="w-full py-3 rounded-md text-center flex items-center justify-center bg-opacity-80 bg-red-600 shadow-lg text-red-50 font-bold text-2xl">
          <div>Malaria Risk Index (MRI)</div>
        </div>
        <div class="w-full mt-2  bg-white py-3 rounded-md text-center flex items-center justify-center bg-opacity-90  shadow-lg  font-bold text-2xl">
          <div class="flex items-center flex-row w-full px-4 space-x-2">
            <img src="/malaria.png" width={32} height={32} />
            <div class="flex-1 bg-gradient-to-r from-blue-500 via-green-500 to-red-500 h-4 rounded-md relative">
              <div class="absolute left-[70%] bg-white h-7 -top-[35%] w-3 rounded-lg border-[3px] border-black"></div>
            </div>
            <img src="/malaria_many.png" width={32} height={32} />
          </div>
        </div>
        <div class="w-full mt-4 bg-white py-3 rounded-md text-center flex flex-col space-y-6 bg-opacity-90  shadow-lg  font-bold text-2xl">
          <div class="flex items-center flex-row w-full px-5 space-x-3">
            <img src="/water.png" width={24} height={24} />
            <div class="flex-1 bg-gradient-to-r from-blue-500 via-green-500 to-red-500 h-3 rounded-md relative">
              <div class="absolute left-[70%] bg-white h-6 -top-[35%] w-3 rounded-lg border-[3px] border-black"></div>
            </div>
            <img src="/trees.png" width={24} height={24} />
          </div>

          <div class="flex items-center flex-row w-full px-5 space-x-3">
            <img src="/person.png" width={24} height={24} />
            <div class="flex-1 bg-gradient-to-r from-blue-500 via-green-500 to-red-500 h-3 rounded-md relative">
              <div class="absolute left-[70%] bg-white h-6 -top-[35%] w-3 rounded-lg border-[3px] border-black"></div>
            </div>
            <img src="/people.png" width={24} height={24} />
          </div>
          <div class="flex items-center flex-row w-full px-5 space-x-3">
            <img src="/desert.png" width={24} height={24} />
            <div class="flex-1 bg-gradient-to-r from-blue-500 via-green-500 to-red-500 h-3 rounded-md relative">
              <div class="absolute left-[70%] bg-white h-6 -top-[35%] w-3 rounded-lg border-[3px] border-black"></div>
            </div>
            <img src="/rain.png" width={24} height={24} />
          </div>
          <div class="flex items-center flex-row w-full px-5 space-x-3">
            <img src="/cold.png" width={24} height={24} />
            <div class="flex-1 bg-gradient-to-r from-blue-500 via-green-500 to-red-500 h-3 rounded-md relative">
              <div class="absolute left-[70%] bg-white h-6 -top-[35%] w-3 rounded-lg border-[3px] border-black"></div>
            </div>
            <img src="/hot.png" width={24} height={24} />
          </div>
        </div>
      </div>
      <div class="fixed left-[50vw] -translate-x-[50%] top-4 flex flex-row space-x-2">
        <div class="bg-white border-[3px] border-red-500 w-[180px] shadow-lg rounded-md flex flex-row justify-center items-center">
          <div class="font-semibold text-lg py-1">Karnataka</div>
        </div>
        <div class="bg-white w-[180px] border-[3px] border-red-500  shadow-lg rounded-md flex flex-row justify-center items-center">
          <div class="font-semibold text-lg py-1">23 Jan 2023</div>
        </div>
      </div>
    </>
  );
}
